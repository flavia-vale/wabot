import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { broadcastRoutes } from '../src/api/routes/broadcast.js'
import { beginIdempotent, extractIdempotencyKey, _resetIdempotency } from '../src/api/idempotency.js'
import { _resetBroadcastHistory } from '../src/api/quotas.js'

function buildApp({ sendCalls } = {}) {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  app.register(broadcastRoutes, {
    prefix: '/api/broadcast',
    db: {
      group: { findMany: async () => [{ waJid: 'meu@g.us' }] },
      user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
    },
    isRunning: async () => true,
    sendBroadcast: async (...args) => { sendCalls?.push(args); return { ok: true, id: sendCalls?.length ?? 1 } },
  })
  return app
}

test('extractIdempotencyKey lê header e body, apara e limita tamanho', () => {
  assert.equal(extractIdempotencyKey({ headers: { 'idempotency-key': '  abc ' }, body: {} }), 'abc')
  assert.equal(extractIdempotencyKey({ headers: {}, body: { idempotencyKey: 'xyz' } }), 'xyz')
  assert.equal(extractIdempotencyKey({ headers: {}, body: {} }), null)
  assert.equal(extractIdempotencyKey({ headers: { 'idempotency-key': 'a'.repeat(500) }, body: {} }).length, 200)
})

test('beginIdempotent: primeira chave é fresh, replay devolve resultado commitado', () => {
  _resetIdempotency()
  const first = beginIdempotent('u1', 'k1', 1000)
  assert.equal(first.fresh, true)
  first.commit({ ok: true, n: 1 })
  const second = beginIdempotent('u1', 'k1', 2000)
  assert.equal(second.replay, true)
  assert.deepEqual(second.result, { ok: true, n: 1 })
})

test('beginIdempotent: chave em curso (sem commit) retorna inFlight', () => {
  _resetIdempotency()
  beginIdempotent('u1', 'k2', 1000) // pending, sem commit
  const concurrent = beginIdempotent('u1', 'k2', 1100)
  assert.equal(concurrent.inFlight, true)
})

test('beginIdempotent: release libera o slot para novo retry', () => {
  _resetIdempotency()
  const a = beginIdempotent('u1', 'k3', 1000)
  a.release()
  const b = beginIdempotent('u1', 'k3', 1200)
  assert.equal(b.fresh, true)
})

test('beginIdempotent: chave expirada é tratada como nova', () => {
  _resetIdempotency()
  const a = beginIdempotent('u1', 'k4', 1000)
  a.commit({ ok: true })
  // TTL default >= 60s; avança bem além
  const later = beginIdempotent('u1', 'k4', 1000 + 11 * 60_000)
  assert.equal(later.fresh, true)
})

test('beginIdempotent: chaves são isoladas por tenant', () => {
  _resetIdempotency()
  const a = beginIdempotent('u1', 'shared', 1000)
  a.commit({ owner: 'u1' })
  const b = beginIdempotent('u2', 'shared', 1000)
  assert.equal(b.fresh, true, 'mesma chave de outro tenant não colide')
})

test('POST /send: retry com mesma Idempotency-Key não reexecuta o envio', async () => {
  _resetIdempotency(); _resetBroadcastHistory()
  const sendCalls = []
  const app = buildApp({ sendCalls })
  const headers = { 'idempotency-key': 'req-123' }
  const payload = { text: 'oferta', jids: ['meu@g.us'] }

  const r1 = await app.inject({ method: 'POST', url: '/api/broadcast/send', headers, payload })
  const r2 = await app.inject({ method: 'POST', url: '/api/broadcast/send', headers, payload })

  assert.equal(r1.statusCode, 200)
  assert.equal(r2.statusCode, 200)
  assert.equal(sendCalls.length, 1, 'envio executado uma única vez')
  assert.deepEqual(JSON.parse(r1.body), JSON.parse(r2.body), 'resposta idêntica no replay')
  _resetIdempotency(); _resetBroadcastHistory()
})

test('POST /send: sem Idempotency-Key cada chamada executa (comportamento legado)', async () => {
  _resetIdempotency(); _resetBroadcastHistory()
  const sendCalls = []
  const app = buildApp({ sendCalls })
  const payload = { text: 'oferta', jids: ['meu@g.us'] }
  await app.inject({ method: 'POST', url: '/api/broadcast/send', payload })
  await app.inject({ method: 'POST', url: '/api/broadcast/send', payload })
  assert.equal(sendCalls.length, 2)
  _resetIdempotency(); _resetBroadcastHistory()
})
