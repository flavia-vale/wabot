// P1-4 — loja não suportada (docs/produto/backlog-p1-4-loja-nao-suportada.md).
// Guardas obrigatórias da issue (§6): privacidade, defeito 1a, agregação e poda.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  registrableDomain,
  distinctRegistrableDomains,
  linkRemovedSkipReason,
} from '../src/core/unsupportedStore.js'
import {
  createUnsupportedStoreSignal,
  incrementDailyCount,
  pruneOldCounts,
  brtDay,
  UNSUPPORTED_STORE_EVENT,
  OVERFLOW_DOMAIN,
} from '../src/observability/unsupportedStoreSignal.js'
import { ANALYTICS_EVENTS } from '../src/analytics.js'
import { sanitizeInviteLinks } from '../src/messageProcessor.js'
import { findCandidateLinks } from '../src/core/customDomainLinkResolver.js'
import { explainErrorMsg } from '../dashboard/lib/painel/logsCopy.js'
import { friendlyMobileLogError } from '../dashboard/lib/mobileLogs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DAY_MS = 24 * 60 * 60 * 1000

// Banco falso: guarda exatamente o que o módulo mandaria gravar, para a guarda
// de privacidade inspecionar campo por campo.
function createFakeDb() {
  const rows = new Map()
  const calls = { create: 0, updateMany: 0 }
  return {
    rows,
    calls,
    analyticsEvent: {
      async findUnique({ where }) {
        const row = rows.get(where.id)
        return row ? { metadata: row.metadata } : null
      },
      async create({ data }) {
        calls.create += 1
        if (rows.has(data.id)) {
          const err = new Error('Unique constraint failed on the fields: (`id`)')
          err.code = 'P2002'
          throw err
        }
        rows.set(data.id, { ...data })
        return data
      },
      async updateMany({ where, data }) {
        calls.updateMany += 1
        const row = rows.get(where.id)
        if (!row || row.metadata !== where.metadata) return { count: 0 }
        row.metadata = data.metadata
        return { count: 1 }
      },
      async deleteMany({ where }) {
        let count = 0
        for (const [id, row] of rows) {
          if (row.event === where.event && row.createdAt < where.createdAt.lt) {
            rows.delete(id)
            count += 1
          }
        }
        return { count }
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Domínio registrável
// ---------------------------------------------------------------------------

test('registrableDomain guarda só o domínio registrável', () => {
  assert.equal(registrableDomain('https://share.temu.com/s/abc?ref=123#x'), 'temu.com')
  assert.equal(registrableDomain('https://www.kabum.com.br/produto/123/placa?utm=x'), 'kabum.com.br')
  assert.equal(registrableDomain('http://WWW.Natura.com.br./p'), 'natura.com.br')
  assert.equal(registrableDomain('https://temu.to/k/abc'), 'temu.to')
  assert.equal(registrableDomain('https://loja.exemplo.co.uk/a'), 'exemplo.co.uk')
})

test('registrableDomain recusa o que não é host público', () => {
  for (const bad of [
    'not a url', '', null, 'https://localhost/x', 'http://192.168.0.1/admin',
    'https://[::1]/x', 'ftp://', 'https://com.br/',
  ]) {
    const got = registrableDomain(bad)
    assert.ok(got === null || !/[/?#=&:@]/.test(got), `inesperado para ${bad}: ${got}`)
  }
  assert.equal(registrableDomain('http://192.168.0.1/admin'), null)
  assert.equal(registrableDomain('https://localhost/x'), null)
})

test('distinctRegistrableDomains conta cada domínio uma vez por mensagem', () => {
  assert.deepEqual(
    distinctRegistrableDomains(['https://temu.com/a', 'https://www.temu.com/b?c=1', 'https://kabum.com.br/x']),
    ['temu.com', 'kabum.com.br'],
  )
})

// ---------------------------------------------------------------------------
// Defeito 1a — a oferta com link só de loja não suportada saía em silêncio
// ---------------------------------------------------------------------------

test('não regredir: o sanitizador continua APAGANDO o link de loja não suportada', () => {
  const texto = 'Tênis X por R$ 99 👉 https://share.temu.com/s/abc?ref=123'
  const limpo = sanitizeInviteLinks(texto)
  assert.doesNotMatch(limpo, /temu/i)
  assert.match(limpo, /Tênis X/)
  // e o link apagado é exatamente o que a contagem enxerga
  assert.deepEqual(distinctRegistrableDomains(findCandidateLinks(texto)), ['temu.com'])
})

test('oferta cujo único link era de loja não suportada vira descarte com motivo', () => {
  assert.equal(
    linkRemovedSkipReason({ supportedLinkCount: 0, unsupportedLinkCount: 1 }),
    'skip:link_removed:unsupported_store',
  )
  assert.equal(
    linkRemovedSkipReason({ supportedLinkCount: 0, unsupportedLinkCount: 2, offerEndedAtSource: true }),
    'skip:link_removed:offer_ended_at_source',
  )
})

test('oferta com link de loja suportada ou mensagem sem link nenhum segue igual', () => {
  assert.equal(linkRemovedSkipReason({ supportedLinkCount: 1, unsupportedLinkCount: 3 }), null)
  assert.equal(linkRemovedSkipReason({ supportedLinkCount: 0, unsupportedLinkCount: 0 }), null)
})

test('painel e celular explicam o descarte em linguagem simples', () => {
  const desktop = explainErrorMsg('skip:link_removed:unsupported_store')
  assert.match(desktop, /único link/i)
  assert.match(desktop, /ainda não convertemos/i)
  assert.doesNotMatch(desktop, /fora das regras/i)
  assert.match(explainErrorMsg('skip:link_removed:offer_ended_at_source'), /encerrada/i)
  assert.match(friendlyMobileLogError('skip:link_removed:unsupported_store'), /ainda não convertemos/i)
  assert.match(friendlyMobileLogError('skip:link_removed:offer_ended_at_source'), /encerrada/i)
})

test('bot-worker descarta com motivo no caminho que antes publicava sem link', () => {
  const src = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')
  const recordIdx = src.indexOf('unsupportedStoreSignal.record(linksDeLojaNaoSuportada)')
  const policyIdx = src.indexOf('if (!canForwardCurrentMessage) {')
  const skipIdx = src.indexOf('await recordLinkRemovedSkip(motivoLinkRemovido)')
  const platformFilterIdx = src.indexOf('// Filtro por plataforma (override por grupo monitorado')
  assert.ok(recordIdx > 0 && recordIdx < policyIdx, 'registro precisa acontecer antes da política (vale para os dois caminhos)')
  assert.ok(skipIdx > policyIdx && skipIdx < platformFilterIdx, 'descarte precisa ficar entre a política e o resto do fluxo')
  // Módulo-level, sem timer próprio: o flush pega carona no watchdog existente.
  const declIdx = src.indexOf('const unsupportedStoreSignal = createUnsupportedStoreSignal(')
  assert.ok(declIdx > 0 && declIdx < src.indexOf('async function startBotInner()'))
  assert.match(src, /unsupportedStoreSignal\.flushIfDue\(\)/)
  assert.doesNotMatch(src, /setInterval\([^)]*unsupportedStore/)
})

// ---------------------------------------------------------------------------
// Agregação, privacidade e poda
// ---------------------------------------------------------------------------

test('evento está na allowlist de analytics', () => {
  assert.ok(ANALYTICS_EVENTS.has(UNSUPPORTED_STORE_EVENT))
})

test('agregação: N mensagens do mesmo domínio no mesmo dia viram UMA linha com count N', async () => {
  const db = createFakeDb()
  let t = Date.parse('2026-09-29T15:00:00Z')
  const signal = createUnsupportedStoreSignal({ db, now: () => t, enabled: () => true })
  for (let i = 0; i < 25; i++) {
    signal.record([`https://share.temu.com/s/prod-${i}?ref=cliente${i}`])
    t += 60_000
  }
  await signal.flush()
  const temu = [...db.rows.values()].filter(r => JSON.parse(r.metadata).domain === 'temu.com')
  assert.equal(temu.length, 1, 'uma linha por dia e domínio, nunca uma por mensagem')
  assert.equal(JSON.parse(temu[0].metadata).count, 25)
  assert.ok(db.calls.create <= 1)
})

test('agregação entre processos: dois contadores somam na MESMA linha', async () => {
  const db = createFakeDb()
  const now = () => Date.parse('2026-09-29T15:00:00Z')
  const a = createUnsupportedStoreSignal({ db, now, enabled: () => true, flushIntervalMs: 1e12 })
  const b = createUnsupportedStoreSignal({ db, now, enabled: () => true, flushIntervalMs: 1e12 })
  a.record(['https://kabum.com.br/a'])
  a.record(['https://kabum.com.br/b'])
  b.record(['https://www.kabum.com.br/c'])
  await Promise.all([a.flush(), b.flush()])
  assert.equal(db.rows.size, 1)
  assert.equal(JSON.parse([...db.rows.values()][0].metadata).count, 3)
})

test('PRIVACIDADE: nenhuma URL, caminho, query, texto ou conta chega ao que é gravado', async () => {
  const db = createFakeDb()
  const signal = createUnsupportedStoreSignal({ db, now: () => Date.parse('2026-09-29T15:00:00Z'), enabled: () => true })
  const segredos = ['prod-segredo-42', 'ref=cliente-xyz', 'utm_source', 'Tênis', 'R$', 'caminho/secreto', 'share.', 'www.']
  signal.record([
    'https://share.temu.com/prod-segredo-42/caminho/secreto?ref=cliente-xyz&utm_source=grupo',
    'https://www.natura.com.br/p/perfume?utm_source=grupo#Tênis R$',
    'http://usuario:senha@kabum.com.br/produto',
  ])
  await signal.flush()
  assert.ok(db.rows.size >= 2)
  for (const row of db.rows.values()) {
    assert.deepEqual(Object.keys(row).sort(), ['createdAt', 'event', 'id', 'metadata', 'userId'])
    assert.equal(row.userId, null, 'nunca identificador de cliente junto do domínio')
    assert.equal(row.event, UNSUPPORTED_STORE_EVENT)
    const meta = JSON.parse(row.metadata)
    assert.deepEqual(Object.keys(meta).sort(), ['count', 'day', 'domain'], 'só domínio + dia + contagem')
    assert.match(meta.domain, /^[a-z0-9-]+(\.[a-z0-9-]+){1,2}$/)
    assert.match(meta.day, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(typeof meta.count, 'number')
    const tudo = `${row.id} ${row.metadata}`
    assert.doesNotMatch(tudo, /https?:|[/?#&@]|%2F/i, 'nada de URL, caminho ou query')
    for (const s of segredos) assert.ok(!tudo.includes(s), `vazou "${s}" em ${tudo}`)
    assert.ok(!tudo.includes('senha') && !tudo.includes('usuario'))
  }
})

test('memória limitada: domínio novo além do teto cai em "outros"', async () => {
  const db = createFakeDb()
  const signal = createUnsupportedStoreSignal({ db, now: () => Date.parse('2026-09-29T15:00:00Z'), enabled: () => true, flushIntervalMs: 1e12 })
  signal.record(['https://primeiro.com/x']) // primeiro registro grava na hora
  await signal.flush()
  for (let i = 0; i < 500; i++) signal.record([`https://loja${i}.com/x`])
  assert.ok(signal.pendingSize() <= 51, `pendentes: ${signal.pendingSize()}`)
  await signal.flush()
  assert.equal(signal.pendingSize(), 0, 'flush esvazia o Map')
  const outros = [...db.rows.values()].find(r => JSON.parse(r.metadata).domain === OVERFLOW_DOMAIN)
  assert.ok(outros && JSON.parse(outros.metadata).count > 0)
})

test('PODA: registro com mais de 30 dias some, o recente fica', async () => {
  const db = createFakeDb()
  const now = Date.parse('2026-09-29T15:00:00Z')
  await incrementDailyCount(db, { day: brtDay(now - 31 * DAY_MS), domain: 'temu.com', delta: 7 })
  await incrementDailyCount(db, { day: brtDay(now - 29 * DAY_MS), domain: 'temu.com', delta: 3 })
  await incrementDailyCount(db, { day: brtDay(now), domain: 'temu.com', delta: 1 })
  const removed = await pruneOldCounts(db, now)
  assert.equal(removed, 1)
  const dias = [...db.rows.values()].map(r => JSON.parse(r.metadata).day).sort()
  assert.deepEqual(dias, [brtDay(now - 29 * DAY_MS), brtDay(now)])
})

test('PODA roda sozinha no flush, sem timer próprio', async () => {
  const db = createFakeDb()
  const now = Date.parse('2026-09-29T15:00:00Z')
  await incrementDailyCount(db, { day: brtDay(now - 45 * DAY_MS), domain: 'natura.com.br', delta: 2 })
  const signal = createUnsupportedStoreSignal({ db, now: () => now, enabled: () => true })
  signal.record(['https://temu.com/x'])
  await signal.flush()
  const dominios = [...db.rows.values()].map(r => JSON.parse(r.metadata).domain)
  assert.deepEqual(dominios, ['temu.com'])
})

test('falha de gravação devolve a contagem para o próximo flush', async () => {
  const db = createFakeDb()
  let quebrado = true
  const original = db.analyticsEvent.findUnique
  db.analyticsEvent.findUnique = async (args) => {
    if (quebrado) throw new Error('SQLITE_BUSY')
    return original(args)
  }
  const signal = createUnsupportedStoreSignal({ db, now: () => Date.parse('2026-09-29T15:00:00Z'), enabled: () => true, flushIntervalMs: 1e12 })
  signal.record(['https://temu.com/a'])
  signal.record(['https://temu.com/b'])
  await signal.flush()
  assert.equal(db.rows.size, 0)
  quebrado = false
  await signal.flush()
  assert.equal(JSON.parse([...db.rows.values()][0].metadata).count, 2)
})

test('analytics desligado: nada é acumulado', () => {
  const db = createFakeDb()
  const signal = createUnsupportedStoreSignal({ db, enabled: () => false })
  assert.equal(signal.record(['https://temu.com/x']), 0)
  assert.equal(signal.pendingSize(), 0)
})

test('Prisma real: soma na mesma linha e poda por data', async () => {
  const { default: db } = await import('../src/db.js')
  const now = Date.parse('2026-09-29T15:00:00Z')
  const hoje = brtDay(now)
  const velho = brtDay(now - 40 * DAY_MS)
  await db.analyticsEvent.deleteMany({ where: { event: UNSUPPORTED_STORE_EVENT } })
  try {
    await incrementDailyCount(db, { day: hoje, domain: 'temu.com', delta: 2 })
    await incrementDailyCount(db, { day: hoje, domain: 'temu.com', delta: 3 })
    await incrementDailyCount(db, { day: velho, domain: 'temu.com', delta: 9 })
    const antes = await db.analyticsEvent.findMany({ where: { event: UNSUPPORTED_STORE_EVENT } })
    assert.equal(antes.length, 2)
    const deHoje = antes.find(r => JSON.parse(r.metadata).day === hoje)
    assert.deepEqual(JSON.parse(deHoje.metadata), { domain: 'temu.com', day: hoje, count: 5 })
    assert.equal(deHoje.userId, null)
    assert.equal(await pruneOldCounts(db, now), 1)
    const depois = await db.analyticsEvent.findMany({ where: { event: UNSUPPORTED_STORE_EVENT } })
    assert.equal(depois.length, 1)
  } finally {
    await db.analyticsEvent.deleteMany({ where: { event: UNSUPPORTED_STORE_EVENT } })
  }
})
