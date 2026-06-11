import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { resolveTargetJids, validateOwnedTargetJids, validateBroadcastText, MAX_BROADCAST_TARGETS, MAX_BROADCAST_TEXT_CHARS } from '../src/api/routes/broadcastTargets.js'
import { broadcastRoutes } from '../src/api/routes/broadcast.js'
import { offerAutomationRoutes } from '../src/api/routes/offerAutomation.js'

function dbWithGroups(jids) {
  return {
    group: { findMany: async () => jids.map((waJid) => ({ waJid })) },
    user: { findUnique: async () => ({ plan: 'pro', accessExpiresAt: null }) },
  }
}

test('resolveTargetJids rejeita JID explícito não cadastrado como destino do tenant', async () => {
  const db = dbWithGroups(['meu@g.us'])
  await assert.rejects(
    () => resolveTargetJids({ db, userId: 'u1', jids: ['alheio@g.us'] }),
    (err) => err.statusCode === 400 && /não cadastrado/.test(err.message),
  )
})

test('resolveTargetJids aceita JIDs explícitos cadastrados', async () => {
  const db = dbWithGroups(['a@g.us', 'b@g.us'])
  const jids = await resolveTargetJids({ db, userId: 'u1', jids: ['a@g.us'] })
  assert.deepEqual(jids, ['a@g.us'])
})

test('resolveTargetJids aplica teto de destinos por envio', async () => {
  const many = Array.from({ length: MAX_BROADCAST_TARGETS + 1 }, (_, i) => `g${i}@g.us`)
  const db = dbWithGroups(many)
  await assert.rejects(
    () => resolveTargetJids({ db, userId: 'u1', jids: many }),
    (err) => err.statusCode === 400 && /Máximo de/.test(err.message),
  )
})

test('validateOwnedTargetJids lista os JIDs ofensores na mensagem', async () => {
  const db = dbWithGroups(['ok@g.us'])
  await assert.rejects(
    () => validateOwnedTargetJids({ db, userId: 'u1', jids: ['ok@g.us', 'ruim@g.us'] }),
    (err) => /ruim@g\.us/.test(err.message),
  )
})

test('validateBroadcastText rejeita texto acima do limite', () => {
  assert.throws(
    () => validateBroadcastText('x'.repeat(MAX_BROADCAST_TEXT_CHARS + 1)),
    (err) => err.statusCode === 400 && /limite/.test(err.message),
  )
  assert.doesNotThrow(() => validateBroadcastText('x'.repeat(100)))
})

test('POST /api/broadcast/send com JID alheio retorna 400 e não envia', async () => {
  let sent = false
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  app.register(broadcastRoutes, {
    prefix: '/api/broadcast',
    db: dbWithGroups(['meu@g.us']),
    isRunning: async () => true,
    sendBroadcast: async () => { sent = true; return { ok: true } },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/send',
    payload: { text: 'oferta', jids: ['alheio@g.us'] },
  })
  assert.equal(res.statusCode, 400)
  assert.equal(sent, false, 'sendBroadcast não deve ser chamado')
})

test('POST /api/broadcast/send com texto gigante retorna 400', async () => {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  app.register(broadcastRoutes, {
    prefix: '/api/broadcast',
    db: dbWithGroups(['meu@g.us']),
    isRunning: async () => true,
    sendBroadcast: async () => ({ ok: true }),
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/broadcast/send',
    payload: { text: 'x'.repeat(MAX_BROADCAST_TEXT_CHARS + 1), jids: ['meu@g.us'] },
  })
  assert.equal(res.statusCode, 400)
})

test('POST /api/offer-automations rejeita destGroupJid de grupo não cadastrado', async () => {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  const db = {
    ...dbWithGroups(['meu@g.us']),
    offerAutomation: { create: async ({ data }) => ({ id: 'a1', ...data }) },
  }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  const res = await app.inject({
    method: 'POST',
    url: '/api/offer-automations',
    payload: { destGroupJid: 'alheio@g.us', keyword: 'promo', intervalMinutes: 60, offersPerSend: 1 },
  })
  assert.equal(res.statusCode, 400)
})

test('PUT /api/offer-automations/:id rejeita troca de destGroupJid para grupo não cadastrado', async () => {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  const db = {
    ...dbWithGroups(['meu@g.us']),
    offerAutomation: {
      findFirst: async () => ({ id: 'a1', userId: 'u1', intervalMinutes: 60 }),
      update: async ({ data }) => ({ id: 'a1', ...data }),
    },
  }
  app.register(offerAutomationRoutes, { prefix: '/api/offer-automations', db })
  const res = await app.inject({
    method: 'PUT',
    url: '/api/offer-automations/a1',
    payload: { destGroupJid: 'alheio@g.us' },
  })
  assert.equal(res.statusCode, 400)

  const ok = await app.inject({
    method: 'PUT',
    url: '/api/offer-automations/a1',
    payload: { destGroupJid: 'meu@g.us' },
  })
  assert.equal(ok.statusCode, 200)
})
