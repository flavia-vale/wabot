// Sync de UMA conta Awin, com banco real de teste e Awin falsa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import db from '../src/db.js'
import { syncAwinAccount } from '../src/integrations/awin/syncService.js'
import { tickAwinSync } from '../src/integrations/awin/scheduler.js'
import { AwinAuthError, AwinHttpError, AwinRateLimitError } from '../src/integrations/awin/errors.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/awin-promotions-page.json', import.meta.url), 'utf8'))
const NOW = new Date('2026-09-28T12:00:00Z')
let seq = 0

async function makeAccount(overrides = {}) {
  const n = ++seq
  const userId = `awin-sync-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Awin', email: `${userId}@awin-sync.local`, passwordHash: 'x', plan: 'basic' } })
  const account = await db.awinAccount.create({
    data: { userId, label: 'Conta', publisherId: '2701264', tokenEncrypted: 'token-de-teste-bem-comprido', tokenLast4: 'rido', tokenFingerprint: 'fp', ...overrides },
  })
  return { userId, account }
}

async function cleanup(userId) {
  await db.awinAccount.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

function fakeClient(pagesByStatus) {
  const calls = []
  return {
    calls,
    listPromotions: async (token, publisherId, { filters, page }) => {
      calls.push({ token, publisherId, filters, page })
      const handler = pagesByStatus[filters.status]
      if (typeof handler === 'function') return handler(page)
      return handler?.[page - 1] ?? { data: [], pagination: { total: 0 } }
    },
  }
}

const deps = (client) => ({ db, client, now: () => NOW, decrypt: (value) => value })

test('sync grava promoções válidas, ignora cupom/fora do BR e usa filtros fixos (promotion, joined, BR)', async () => {
  const { userId, account } = await makeAccount()
  try {
    const client = fakeClient({ active: [fixture], upcoming: [{ data: [], pagination: { total: 0 } }] })
    const result = await syncAwinAccount(account.id, deps(client))
    assert.equal(result.status, 'success')
    assert.equal(result.inserted, 2)
    assert.equal(result.skipped, 2)
    assert.deepEqual(client.calls[0].filters, { type: 'promotion', status: 'active', membership: 'joined', regionCodes: ['BR'] })
    assert.equal(client.calls[1].filters.status, 'upcoming')
    assert.equal(client.calls[0].token, 'token-de-teste-bem-comprido')

    const rows = await db.awinPromotion.findMany({ where: { accountId: account.id }, orderBy: { promotionId: 'asc' } })
    assert.deepEqual(rows.map((row) => row.promotionId), ['910001', '910002'])
    assert.ok(rows.every((row) => row.userId === userId && row.status === 'active'))

    const run = await db.awinSyncRun.findUnique({ where: { id: result.runId } })
    assert.equal(run.status, 'success')
    assert.equal(run.inserted, 2)
    assert.ok(JSON.parse(run.errorsJson).length >= 1, 'explica as ignoradas')

    const updated = await db.awinAccount.findUnique({ where: { id: account.id } })
    assert.equal(updated.status, 'ok')
    assert.equal(updated.nextSyncAt.getTime(), NOW.getTime() + 60 * 60_000)

    // Segunda passada: nada novo, as duas contam como "atualizadas".
    const again = await syncAwinAccount(account.id, deps(fakeClient({ active: [fixture] })))
    assert.equal(again.inserted, 0)
    assert.equal(again.updated, 2)
  } finally {
    await cleanup(userId)
  }
})

test('pagina até o fim: para quando já leu o total', async () => {
  const { userId, account } = await makeAccount()
  try {
    const make = (start, count) => Array.from({ length: count }, (_, i) => ({ ...fixture.data[1], promotionId: start + i }))
    const client = fakeClient({ active: (page) => ({ data: page === 1 ? make(1, 200) : make(201, 8), pagination: { total: 208 } }) })
    const result = await syncAwinAccount(account.id, deps(client))
    assert.equal(result.status, 'success')
    assert.equal(result.inserted, 208)
    assert.equal(client.calls.filter((call) => call.filters.status === 'active').length, 2)
  } finally {
    await cleanup(userId)
  }
})

test('promoção que sumiu da Awin vence só quando a leitura foi completa', async () => {
  const { userId, account } = await makeAccount()
  try {
    await syncAwinAccount(account.id, deps(fakeClient({ active: [fixture] })))
    // Awin agora devolve só a 910002: a 910001 sumiu.
    const onlySecond = { data: [fixture.data[1]], pagination: { total: 1 } }

    // Execução com erro no meio (upcoming falha): NÃO vence por ausência.
    const failing = fakeClient({ active: [onlySecond], upcoming: () => { throw new AwinHttpError(500) } })
    const partial = await syncAwinAccount(account.id, deps(failing))
    assert.equal(partial.status, 'failed')
    let first = await db.awinPromotion.findFirst({ where: { accountId: account.id, promotionId: '910001' } })
    assert.equal(first.status, 'active')

    const complete = await syncAwinAccount(account.id, deps(fakeClient({ active: [onlySecond] })))
    assert.equal(complete.status, 'success')
    assert.equal(complete.expired, 1)
    first = await db.awinPromotion.findFirst({ where: { accountId: account.id, promotionId: '910001' } })
    assert.equal(first.status, 'expired')
  } finally {
    await cleanup(userId)
  }
})

test('promoção com endDate no passado vence mesmo em execução parcial', async () => {
  const { userId, account } = await makeAccount()
  try {
    await syncAwinAccount(account.id, deps(fakeClient({ active: [fixture] })))
    const later = new Date('2026-09-30T00:00:00Z') // 910001 venceu em 29/09 02:59 UTC
    const result = await syncAwinAccount(account.id, { ...deps(fakeClient({ active: () => { throw new AwinHttpError(502) } })), now: () => later })
    assert.equal(result.status, 'failed')
    const first = await db.awinPromotion.findFirst({ where: { accountId: account.id, promotionId: '910001' } })
    const second = await db.awinPromotion.findFirst({ where: { accountId: account.id, promotionId: '910002' } })
    assert.equal(first.status, 'expired')
    assert.equal(second.status, 'active')
  } finally {
    await cleanup(userId)
  }
})

test('401/403 marca credencial inválida e para de agendar; 429 só reagenda', async () => {
  const { userId, account } = await makeAccount()
  try {
    const limited = await syncAwinAccount(account.id, deps(fakeClient({ active: () => { throw new AwinRateLimitError(120_000) } })))
    assert.equal(limited.status, 'rate_limited')
    let row = await db.awinAccount.findUnique({ where: { id: account.id } })
    assert.notEqual(row.status, 'invalid_credential')
    assert.equal(row.nextSyncAt.getTime(), NOW.getTime() + 5 * 60_000)

    const denied = await syncAwinAccount(account.id, deps(fakeClient({ active: () => { throw new AwinAuthError(401) } })))
    assert.equal(denied.status, 'invalid_credential')
    row = await db.awinAccount.findUnique({ where: { id: account.id } })
    assert.equal(row.status, 'invalid_credential')
    assert.equal(row.nextSyncAt, null)
    assert.match(row.statusDetail, /código de acesso/)

    const scheduled = await syncAwinAccount(account.id, deps(fakeClient({ active: [fixture] })))
    assert.equal(scheduled.skipped, 'not_schedulable', 'agendador não tenta de novo até salvar código novo')
  } finally {
    await cleanup(userId)
  }
})

test('agendador: erro de uma conta não para as outras e conta inválida fica de fora', async () => {
  const a = await makeAccount({ nextSyncAt: new Date(NOW.getTime() - 1000) })
  const b = await makeAccount({ nextSyncAt: new Date(NOW.getTime() - 500), publisherId: '111' })
  const c = await makeAccount({ status: 'invalid_credential', nextSyncAt: null, publisherId: '222' })
  try {
    const seen = []
    const summary = await tickAwinSync({
      db,
      now: () => NOW,
      limit: 1000,
      syncFn: async (id) => {
        seen.push(id)
        if (id === a.account.id) throw new Error('boom')
        return { status: 'success' }
      },
      logger: { error: () => {} },
    })
    assert.ok(seen.includes(a.account.id))
    assert.ok(seen.includes(b.account.id), 'a conta B roda mesmo com a A quebrando')
    assert.ok(!seen.includes(c.account.id), 'conta com código recusado não é agendada')
    assert.ok(summary.failed >= 1)
  } finally {
    await cleanup(a.userId)
    await cleanup(b.userId)
    await cleanup(c.userId)
  }
})

test('histórico guarda no máximo 50 execuções por conta', async () => {
  const { userId, account } = await makeAccount()
  try {
    await db.awinSyncRun.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ userId, accountId: account.id, trigger: 'schedule', status: 'success', startedAt: new Date(NOW.getTime() - (i + 1) * 60_000) })) })
    await syncAwinAccount(account.id, deps(fakeClient({ active: [fixture] })))
    assert.equal(await db.awinSyncRun.count({ where: { accountId: account.id } }), 50)
  } finally {
    await cleanup(userId)
  }
})
