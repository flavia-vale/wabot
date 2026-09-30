// Rakuten: sync de UMA conta (banco real de teste, Rakuten falsa) e rotas
// /api/rakuten (isolamento por cliente, dados só de escrita).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import db from '../src/db.js'
import { syncRakutenAccount } from '../src/integrations/rakuten/syncService.js'
import { tickRakutenSync } from '../src/integrations/rakuten/scheduler.js'
import { RakutenAuthError, RakutenHttpError } from '../src/integrations/rakuten/errors.js'
import { rakutenRoutes } from '../src/api/routes/rakuten.js'

const xml = readFileSync(new URL('./fixtures/rakuten-coupons-page.xml', import.meta.url), 'utf8')
const NOW = new Date('2026-09-30T12:00:00Z')
const identity = (value) => value
let seq = 0

async function makeUser(prefix) {
  const userId = `${prefix}-${++seq}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'Rakuten', email: `${userId}@rakuten.local`, passwordHash: 'x', plan: 'basic' } })
  return userId
}

async function makeAccount(overrides = {}) {
  const userId = await makeUser('rk-sync')
  const account = await db.rakutenAccount.create({
    data: {
      userId, label: 'Conta', sid: '4640819',
      clientIdEncrypted: 'client-id-de-teste', clientIdLast4: 'este',
      clientSecretEncrypted: 'segredo-de-teste', clientSecretLast4: 'este',
      credentialFingerprint: 'fp', ...overrides,
    },
  })
  return { userId, account }
}

async function cleanup(userId) {
  await db.offerAutomation.deleteMany({ where: { userId } })
  await db.rakutenAccount.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

function fakeClient({ pages = [xml], advertiser = true, verify = true } = {}) {
  const calls = { coupons: [], advertisers: [], verify: [] }
  return {
    calls,
    verify: async (creds) => {
      calls.verify.push(creds)
      if (!verify) throw new RakutenAuthError(401)
      return true
    },
    listCoupons: async (creds, { page }) => {
      calls.coupons.push({ creds, page })
      const handler = typeof pages === 'function' ? pages(page) : pages[page - 1]
      if (handler instanceof Error) throw handler
      return handler ?? '<couponfeed></couponfeed>'
    },
    getAdvertiser: async (creds, id) => {
      calls.advertisers.push(id)
      if (!advertiser) throw new RakutenHttpError(500)
      return { advertiser: { id: Number(id), name: `Loja ${id}`, url: `https://loja-${id}.com.br/`, logo_url: `https://merchant.linksynergy.com/fs/logo/lg_${id}` } }
    },
  }
}

const deps = (client, extra = {}) => ({ db, client, now: () => NOW, decrypt: identity, ...extra })

test('sync grava as ofertas válidas com logo da loja, descriptografa os dados e agenda a próxima', async () => {
  const { userId, account } = await makeAccount()
  try {
    const client = fakeClient()
    const result = await syncRakutenAccount(account.id, deps(client))
    assert.equal(result.status, 'success')
    assert.equal(result.inserted, 4)
    assert.equal(result.skipped, 1)
    assert.deepEqual(client.calls.coupons[0].creds, { clientId: 'client-id-de-teste', clientSecret: 'segredo-de-teste', sid: '4640819' })
    assert.deepEqual(client.calls.advertisers.sort(), ['43984', '54198'], 'uma chamada por loja nova')

    const rows = await db.rakutenPromotion.findMany({ where: { accountId: account.id }, orderBy: { promotionId: 'asc' } })
    assert.equal(rows.length, 4)
    assert.ok(rows.every((row) => row.userId === userId && row.status === 'active' && row.logoUrl?.startsWith('https://merchant.linksynergy.com/fs/logo/')))
    assert.equal(rows.find((row) => row.promotionId === '1897539.1097').couponCode, 'BEMVINDO10')

    const updated = await db.rakutenAccount.findUnique({ where: { id: account.id } })
    assert.equal(updated.status, 'ok')
    assert.equal(updated.lastSyncStatus, 'success')
    assert.equal(updated.nextSyncAt.getTime(), NOW.getTime() + 60 * 60_000)

    // 2ª execução: loja já conhecida não pergunta de novo.
    const again = await syncRakutenAccount(account.id, deps(client))
    assert.equal(again.updated, 4)
    assert.equal(client.calls.advertisers.length, 2)
  } finally {
    await cleanup(userId)
  }
})

test('some do feed só vence com leitura completa; vencida pela data vence sempre', async () => {
  const { userId, account } = await makeAccount()
  try {
    await syncRakutenAccount(account.id, deps(fakeClient()))
    // Falha no meio: nada vence por ausência.
    const failed = await syncRakutenAccount(account.id, deps(fakeClient({ pages: [new RakutenHttpError(500)] })))
    assert.equal(failed.status, 'failed')
    assert.equal(await db.rakutenPromotion.count({ where: { accountId: account.id, status: 'active' } }), 4)
    const acc = await db.rakutenAccount.findUnique({ where: { id: account.id } })
    assert.equal(acc.status, 'error')
    assert.equal(acc.nextSyncAt.getTime(), NOW.getTime() + 15 * 60_000)

    // Leitura completa com só uma oferta: as outras vencem.
    const onlyOne = xml.replace(/(<\/link>)[\s\S]*<\/couponfeed>/, '$1</couponfeed>')
    const done = await syncRakutenAccount(account.id, deps(fakeClient({ pages: [onlyOne] })))
    assert.equal(done.status, 'success')
    assert.equal(await db.rakutenPromotion.count({ where: { accountId: account.id, status: 'active' } }), 1)

    // Oferta com fim no passado vence mesmo sem leitura completa.
    await db.rakutenPromotion.updateMany({ where: { accountId: account.id, status: 'active' }, data: { endDate: new Date(NOW.getTime() - 1000) } })
    await syncRakutenAccount(account.id, deps(fakeClient({ pages: [new RakutenHttpError(500)] })))
    assert.equal(await db.rakutenPromotion.count({ where: { accountId: account.id, status: 'active' } }), 0)
  } finally {
    await cleanup(userId)
  }
})

test('dados recusados → invalid_credential e o agendador para de chamar; logo que falha não derruba o sync', async () => {
  const { userId, account } = await makeAccount()
  try {
    const noLogo = await syncRakutenAccount(account.id, deps(fakeClient({ advertiser: false })))
    assert.equal(noLogo.status, 'success')
    assert.equal(await db.rakutenPromotion.count({ where: { accountId: account.id, logoUrl: null } }), 4)

    const result = await syncRakutenAccount(account.id, deps(fakeClient({ pages: [new RakutenAuthError(401)] })))
    assert.equal(result.status, 'invalid_credential')
    const acc = await db.rakutenAccount.findUnique({ where: { id: account.id } })
    assert.equal(acc.status, 'invalid_credential')
    assert.equal(acc.nextSyncAt, null)

    const synced = []
    await tickRakutenSync({ db, now: () => NOW, syncFn: async (id) => { synced.push(id); return { status: 'success' } } })
    assert.ok(!synced.includes(account.id))
    assert.equal((await syncRakutenAccount(account.id, deps(fakeClient()))).skipped, 'not_schedulable')
  } finally {
    await cleanup(userId)
  }
})

// ---- rotas ---------------------------------------------------------------

async function buildApp(client = fakeClient()) {
  const userId = await makeUser('rk-routes')
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(rakutenRoutes, { prefix: '/api/rakuten', client, now: () => NOW, syncFn: async () => ({ status: 'success' }) })
  return { app, userId, client }
}

const VALID = { sid: '4640819', clientId: 'ClienteFicticio0000001', clientSecret: 'SegredoFicticio000000001' }

test('rotas: cadastra testando, nunca devolve os dados, campo vazio mantém, isolamento entre clientes', async () => {
  const a = await buildApp()
  const b = await buildApp()
  try {
    const bad = await a.app.inject({ method: 'POST', url: '/api/rakuten/accounts', payload: { ...VALID, sid: 'abc' } })
    assert.equal(bad.statusCode, 400)

    const created = await a.app.inject({ method: 'POST', url: '/api/rakuten/accounts', payload: VALID })
    assert.equal(created.statusCode, 201)
    const body = JSON.parse(created.body)
    assert.equal(body.account.sid, '4640819')
    assert.equal(body.account.clientSecretMasked, `••••${VALID.clientSecret.slice(-4)}`)
    assert.ok(!created.body.includes(VALID.clientSecret))
    assert.ok(!created.body.includes(VALID.clientId))
    assert.deepEqual(a.client.calls.verify[0], VALID)

    const row = await db.rakutenAccount.findFirst({ where: { userId: a.userId } })
    if (process.env.CREDENTIAL_ENCRYPTION_KEY) assert.match(row.clientSecretEncrypted, /^v1:/, 'guardado cifrado')

    const dup = await a.app.inject({ method: 'POST', url: '/api/rakuten/accounts', payload: VALID })
    assert.equal(dup.statusCode, 409)

    const list = await a.app.inject({ method: 'GET', url: '/api/rakuten/accounts' })
    assert.ok(!list.body.includes(VALID.clientSecret))
    assert.ok(!list.body.includes('Encrypted'))

    // Editar só o apelido: não testa de novo nem mexe nos dados.
    const renamed = await a.app.inject({ method: 'PUT', url: `/api/rakuten/accounts/${row.id}`, payload: { label: 'Minha Rakuten', clientSecret: '' } })
    assert.equal(renamed.statusCode, 200)
    assert.equal(a.client.calls.verify.length, 1)
    const kept = await db.rakutenAccount.findUnique({ where: { id: row.id } })
    assert.equal(kept.clientSecretEncrypted, row.clientSecretEncrypted)
    assert.equal(kept.label, 'Minha Rakuten')

    // Outra cliente não enxerga nem mexe.
    for (const [method, url] of [['PUT', `/api/rakuten/accounts/${row.id}`], ['DELETE', `/api/rakuten/accounts/${row.id}`], ['POST', `/api/rakuten/accounts/${row.id}/test`], ['POST', `/api/rakuten/accounts/${row.id}/sync`], ['GET', `/api/rakuten/accounts/${row.id}/runs`], ['GET', `/api/rakuten/accounts/${row.id}/advertisers`], ['GET', `/api/rakuten/accounts/${row.id}/promotions`]]) {
      const res = await b.app.inject({ method, url, payload: method === 'PUT' ? { label: 'x' } : undefined })
      assert.equal(res.statusCode, 404, `${method} ${url}`)
    }
    assert.equal(JSON.parse((await b.app.inject({ method: 'GET', url: '/api/rakuten/accounts' })).body).length, 0)
  } finally {
    await a.app.close(); await b.app.close()
    await cleanup(a.userId); await cleanup(b.userId)
  }
})

test('rotas: dados recusados → 400 (nunca 401) e nada é salvo; apagar a conta pausa a automação', async () => {
  const refused = await buildApp(fakeClient({ verify: false }))
  const ok = await buildApp()
  try {
    const res = await refused.app.inject({ method: 'POST', url: '/api/rakuten/accounts', payload: VALID })
    assert.equal(res.statusCode, 400)
    assert.match(JSON.parse(res.body).error, /SID, o Client ID e o Client Secret/)
    assert.equal(await db.rakutenAccount.count({ where: { userId: refused.userId } }), 0)

    const created = JSON.parse((await ok.app.inject({ method: 'POST', url: '/api/rakuten/accounts', payload: VALID })).body)
    const automation = await db.offerAutomation.create({ data: { userId: ok.userId, keyword: '', intervalMinutes: 60, source: 'rakuten', rakutenAccountId: created.account.id, enabled: true } })
    const del = await ok.app.inject({ method: 'DELETE', url: `/api/rakuten/accounts/${created.account.id}` })
    assert.equal(JSON.parse(del.body).pausedAutomations, 1)
    const paused = await db.offerAutomation.findUnique({ where: { id: automation.id } })
    assert.equal(paused.enabled, false)
    assert.equal(paused.rakutenAccountId, null)
  } finally {
    await refused.app.close(); await ok.app.close()
    await cleanup(refused.userId); await cleanup(ok.userId)
  }
})
