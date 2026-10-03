import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import { broadcastRoutes } from '../src/api/routes/broadcast.js'
import { smartLinksRoutes } from '../src/api/routes/smartLinks.js'
import { normalizeTargetJids } from '../src/api/routes/broadcastTargets.js'
import { getPlanEntitlements } from '../src/billing/plans.js'
import { _resetBroadcastHistory } from '../src/api/quotas.js'

// Revisão crítica do Telegram (feature 017), PR A — itens 1 a 4. Cada teste
// prova também que o caminho do WhatsApp continua igual.

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('item 1: normalizador não transforma grupo do Telegram em endereço do WhatsApp; WhatsApp igual', () => {
  assert.deepEqual(normalizeTargetJids(['tg:-100123', 'tg:-100999@g.us', '120363@g.us', 'x@newsletter']), ['tg:-100123', 'tg:-100999', '120363@g.us', 'x@newsletter'])
})

test('item 1: robô do WhatsApp descarta destino de outro aplicativo antes de qualquer espera ou tentativa', () => {
  const fn = worker.slice(worker.indexOf('async function processSendJob('))
  const guard = fn.indexOf("deliveryNetworkOfDestinationId(job.destJid) !== DELIVERY_NETWORK.WHATSAPP")
  assert.ok(guard > 0)
  assert.ok(guard < fn.indexOf("data: { status: 'sending'"), 'a trava vem antes de marcar "enviando"')
  assert.ok(guard < fn.indexOf('decideDestinationSpacing'), 'a trava vem antes de reservar a vez')
  assert.match(fn.slice(guard, guard + 800), /skip:destino_outro_aplicativo[\s\S]*return/)
})

test('item 1: "Enviar agora" e agendadas no robô mandam grupo de outro aplicativo para a caixa de saída', () => {
  const broadcast = worker.slice(worker.indexOf("if (msg?.type === 'broadcast') {"))
  assert.ok(broadcast.indexOf('broadcastDeliveryNetwork !== DELIVERY_NETWORK.WHATSAPP') < broadcast.indexOf('db.messageLog.create'))
  const scheduled = worker.slice(worker.indexOf('const state = { remaining: jids.length, hasError: false }'))
  assert.ok(scheduled.indexOf('scheduledDeliveryNetwork !== DELIVERY_NETWORK.WHATSAPP') < scheduled.indexOf('db.messageLog.create'))
  assert.match(worker, /status: state\.hasError \? 'failed' : 'sent', sentAt: new Date\(\) \},\n\s+\}\)\n\s+\}\n\s+\}/)
})

function buildBroadcastApp({ groups, running = true, calls, enq }) {
  _resetBroadcastHistory?.()
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'u1' } })
  app.register(broadcastRoutes, {
    prefix: '/api/broadcast',
    db: {
      group: { findMany: async () => groups.map((waJid) => ({ waJid })) },
      user: { findUnique: async () => ({ plan: 'premium', accessExpiresAt: null }) },
      deliveryOutbox: { create: async ({ data }) => { enq.push(data); return { id: 'o1', ...data } } },
    },
    isRunning: async () => running,
    sendBroadcast: async (...args) => { calls.push(args); return { queued: args[2].length, rejected: 0, errors: [] } },
  })
  return app
}

test('item 1: "Enviar agora" só-WhatsApp chama o robô exatamente como antes', async () => {
  const calls = []
  const enq = []
  const app = buildBroadcastApp({ groups: ['1@g.us', '2@g.us'], calls, enq })
  const res = await app.inject({ method: 'POST', url: '/api/broadcast/send', payload: { text: 'oi', imageUrl: 'https://i/x.jpg' } })
  assert.equal(res.statusCode, 200)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].slice(0, 3), ['u1', 'oi', ['1@g.us', '2@g.us']])
  assert.equal(calls[0][3].imageUrl, 'https://i/x.jpg')
  assert.equal(calls[0][3].source, undefined)
  assert.equal(enq.length, 0)
  await app.close()
})

test('item 1: grupo do Telegram não vai ao robô e não exige o WhatsApp conectado', async () => {
  const calls = []
  const enq = []
  const app = buildBroadcastApp({ groups: ['tg:-100'], running: false, calls, enq })
  const res = await app.inject({ method: 'POST', url: '/api/broadcast/send', payload: { text: 'oi' } })
  assert.equal(res.statusCode, 200)
  assert.equal(calls.length, 0)
  assert.equal(res.json().queued, 1)
  await app.close()
})

test('item 1: misto — WhatsApp desconectado continua recusando quando há destino do WhatsApp', async () => {
  const app = buildBroadcastApp({ groups: ['1@g.us', 'tg:-100'], running: false, calls: [], enq: [] })
  const res = await app.inject({ method: 'POST', url: '/api/broadcast/send', payload: { text: 'oi' } })
  assert.equal(res.statusCode, 400)
  await app.close()
})

test('item 2: Link Inteligente nunca consulta o WhatsApp com grupo de outro aplicativo', async () => {
  let asked = 0
  const app = Fastify()
  app.decorate('authenticate', async (req) => { req.user = { sub: 'owner' } })
  const db = {
    smartLink: { findFirst: async () => ({ id: 'l1', userId: 'owner' }), count: async () => 0, findMany: async () => [] },
    group: { findFirst: async () => ({ id: 'g-tg', waJid: 'tg:-100' }) },
    smartLinkGroup: { count: async () => 0, findFirst: async () => null, create: async () => ({}) },
  }
  await app.register(smartLinksRoutes, { db, loadPlanSubject: async () => ({ plan: 'pro' }), groupInviteCode: async () => { asked++; return { code: 'ABCDEFGHIJ1234' } }, captureSamples: async () => {} })
  const res = await app.inject({ method: 'POST', url: '/l1/groups', payload: { groupId: 'g-tg' } })
  assert.equal(asked, 0)
  assert.equal(res.statusCode, 400)
  assert.match(res.json().error, /só com grupos do WhatsApp/)
  await app.close()
})

test('item 2: rotas de grupo que consultam o WhatsApp recusam grupo de outro aplicativo', () => {
  const routes = readFileSync(new URL('../src/api/routes/groups.js', import.meta.url), 'utf8')
  for (const r of ['follow-now', 'snapshot-now', 'recreate', 'health', 'probe-ping', 'risk-score/recompute', 'refresh-admin']) {
    const body = routes.slice(routes.indexOf(`'/:id/${r}'`), routes.indexOf(`'/:id/${r}'`) + 500)
    assert.match(body, /isOtherDeliveryNetworkGroup\(group\)/, r)
  }
})

test('item 3: Premium vencido perde o Telegram; liberação manual (sem data) e em dia mantêm; Pro/Basic iguais', () => {
  const past = new Date(Date.now() - 86400_000)
  const future = new Date(Date.now() + 86400_000)
  assert.equal(getPlanEntitlements({ plan: 'premium', accessExpiresAt: past }).canUseMultiNetwork, false)
  assert.equal(getPlanEntitlements({ plan: 'premium', accessExpiresAt: future }).canUseMultiNetwork, true)
  assert.equal(getPlanEntitlements({ plan: 'premium', accessExpiresAt: null }).canUseMultiNetwork, true)
  for (const plan of ['pro', 'basic', 'trial']) assert.equal(getPlanEntitlements({ plan, accessExpiresAt: future }).canUseMultiNetwork, false)
  // Nada mais mudou nos outros direitos.
  const pro = getPlanEntitlements({ plan: 'pro', accessExpiresAt: past })
  assert.equal(pro.canUseChannels, true)
  assert.equal(getPlanEntitlements({ plan: 'premium', accessExpiresAt: past }).canUseInstagramStories, true)
})
