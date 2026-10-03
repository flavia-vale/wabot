import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../src/db.js'
import { TelegramApiError } from '../src/delivery/telegram/api.js'
import { createTelegramAdapter } from '../src/delivery/telegram/adapter.js'
import { startTelegramUpdatesLoop } from '../src/delivery/telegram/updatesLoop.js'
import { HEALTH_SIGNAL, NETWORK_HEALTH, computeNetworkHealth, decideHealthAlert } from '../src/core/delivery/networkHealth.js'
import { runDeliveryOutboxTick } from '../src/deliveryOutbox/sweep.js'
import { evaluateQueueGate } from '../src/offerQueue/dispatcher.js'

// Revisão crítica do Telegram, PR B — itens 5 a 10.

const err = (code, description, extra = {}) => new TelegramApiError('x', { status: code, errorCode: code, description, ...extra })
const base = { getMe: async () => ({ id: 1, username: 'b' }), getChatMember: async () => ({ status: 'administrator' }) }

test('item 5: foto que o Telegram não baixa — a oferta sai só com o texto e a redução é registrada', async () => {
  const sent = []
  const adapter = createTelegramAdapter({ db: null, api: { ...base,
    sendPhoto: async () => { throw err(400, 'Bad Request: failed to get HTTP URL content') },
    sendMessage: async (c, text) => { sent.push(text); return { message_id: 7 } } } })
  const r = await adapter.send({ texto: 'Fone', linkConvertido: 'https://s.shopee.com.br/x', imagem: { url: 'https://x/y.webp' } }, 'tg:-1')
  assert.equal(r.ok, true)
  assert.deepEqual(r.reducoes, ['imagem_removida'])
  assert.match(sent[0], /Fone/)
})

test('item 5: recusa do GRUPO (robô removido) continua sendo falha — não vira "só texto"', async () => {
  let texts = 0
  const adapter = createTelegramAdapter({ db: null, api: { ...base,
    sendPhoto: async () => { throw err(403, 'Forbidden: bot was kicked from the group chat') },
    sendMessage: async () => { texts++; return { message_id: 1 } } } })
  const r = await adapter.send({ texto: 'x', imagem: { url: 'https://x/y.jpg' } }, 'tg:-1')
  assert.equal(r.ok, false)
  assert.equal(r.motivo, 'robo_nao_adicionado')
  assert.equal(texts, 0)
})

test('item 6: legenda e texto medidos DEPOIS do HTML — nunca passam do limite', async () => {
  const calls = []
  const adapter = createTelegramAdapter({ db: null, api: { ...base,
    sendPhoto: async (c, u, caption = '') => { calls.push(['photo', caption.length]); if (caption.length > 1024) throw err(400, 'caption is too long'); return { message_id: 1 } },
    sendMessage: async (c, text) => { calls.push(['text', text.length]); if (text.length > 4096) throw err(400, 'message is too long'); return { message_id: 2 } } } })
  const r1 = await adapter.send({ texto: '&'.repeat(1000), imagem: { url: 'https://x/y.jpg' } }, 'tg:-1')
  assert.equal(r1.ok, true)
  assert.deepEqual(calls.map((c) => c[0]), ['photo', 'text'], 'foto sem legenda + texto inteiro')
  calls.length = 0
  const r2 = await adapter.send({ texto: '<&>'.repeat(3000) }, 'tg:-1')
  assert.equal(r2.ok, true)
  assert.ok(calls[0][1] <= 4096)
})

test('item 6: texto curto continua saindo como legenda da foto (igual antes)', async () => {
  const calls = []
  const adapter = createTelegramAdapter({ db: null, api: { ...base,
    sendPhoto: async (c, u, caption) => { calls.push(['photo', caption]); return { message_id: 1 } },
    sendMessage: async () => { calls.push(['text']); return { message_id: 2 } } } })
  await adapter.send({ texto: '*Oferta* boa', imagem: { url: 'https://x/y.jpg' } }, 'tg:-1')
  assert.deepEqual(calls, [['photo', '<b>Oferta</b> boa']])
})

async function newUserWithGroups(n) {
  const userId = `u-${randomUUID()}`
  await db.user.create({ data: { id: userId, name: 'T', email: `${userId}@t.local`, passwordHash: 'x', plan: 'premium' } })
  const ids = []
  for (let i = 0; i < n; i++) {
    const waJid = `tg:${-1000 - Math.floor(Math.random() * 1e9)}`
    await db.group.create({ data: { userId, waJid, name: waJid, role: 'post', kind: 'group', deliveryNetwork: 'telegram' } })
    ids.push(waJid)
  }
  return { userId, ids }
}

test('item 7: conta com fila enorme não trava as outras — todas as contas saem na primeira passada', async () => {
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const big = await newUserWithGroups(2)
  const t = Date.now() - 60_000
  await db.deliveryOutbox.createMany({ data: Array.from({ length: 300 }, (_, i) => ({ userId: big.userId, deliveryNetwork: 'telegram', destinationId: big.ids[i % 2], offerJson: '{"texto":"a"}', status: 'pending', enqueuedAt: new Date(t + i) })) })
  const small = await newUserWithGroups(1)
  await db.deliveryOutbox.create({ data: { userId: small.userId, deliveryNetwork: 'telegram', destinationId: small.ids[0], offerJson: '{"texto":"b"}', status: 'pending', enqueuedAt: new Date(t + 10_000) } })
  const sentTo = []
  await runDeliveryOutboxTick({ deliveryNetwork: 'telegram', db, adapter: { send: async (o, d) => { sentTo.push(d); return { ok: true } } }, canUseMultiNetwork: async () => true, env: {}, intervalMs: 5000 })
  assert.ok(sentTo.includes(small.ids[0]), 'a conta pequena saiu na primeira passada')
  assert.equal(sentTo.length, 3)
})

test('item 7: redução feita pelo envio (foto não baixou) fica no histórico', async () => {
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const u = await newUserWithGroups(1)
  await db.deliveryOutbox.create({ data: { userId: u.userId, deliveryNetwork: 'telegram', destinationId: u.ids[0], offerJson: '{"texto":"a","imagem":{"url":"https://x"}}', status: 'pending' } })
  await runDeliveryOutboxTick({ deliveryNetwork: 'telegram', db, adapter: { send: async () => ({ ok: true, reducoes: ['imagem_removida'] }) }, canUseMultiNetwork: async () => true, env: {}, intervalMs: 5000 })
  const log = await db.messageLog.findFirst({ where: { userId: u.userId } })
  assert.equal(log.deliveryReductions, 'imagem_removida')
})

test('item 8: 409 persistente vira estado "conflito" e avisa; erro de leitura chega ao vigia', async () => {
  const now = 10_000_000
  const h = computeNetworkHealth([{ kind: 'ok', at: now - 50_000 }, { kind: HEALTH_SIGNAL.CONFLITO, at: now - 30_000 }, { kind: HEALTH_SIGNAL.CONFLITO, at: now - 5_000 }], { now })
  assert.equal(h.estado, NETWORK_HEALTH.CONFLITO)
  assert.deepEqual(decideHealthAlert({ estado: 'funcionando' }, h), { sinal: 'delivery_network_down', estado: 'conflito' })

  const seen = []
  let calls = 0
  const loop = startTelegramUpdatesLoop({
    api: { getUpdates: async () => { calls++; if (calls > 2) loop.stop(); throw err(409, 'Conflict: terminated by other getUpdates request') } },
    onError: (e) => seen.push(e.errorCode),
    sleep: async () => {},
  })
  await loop.done
  assert.deepEqual(seen.slice(0, 2), [409, 409])
})

test('item 9: grupo que vira supergrupo leva junto as ofertas que estavam na fila', async () => {
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const u = await newUserWithGroups(1)
  const oldChat = u.ids[0].slice(3)
  const row = await db.deliveryOutbox.create({ data: { userId: u.userId, deliveryNetwork: 'telegram', destinationId: u.ids[0], offerJson: '{}', status: 'pending' } })
  const adapter = createTelegramAdapter({ db, api: base })
  await adapter.migrateDestination(oldChat, '-100777888')
  assert.equal((await db.deliveryOutbox.findUnique({ where: { id: row.id } })).destinationId, 'tg:-100777888')
  assert.equal((await db.group.findFirst({ where: { userId: u.userId } })).waJid, 'tg:-100777888')
})

test('item 10: fila só de Telegram não para quando o WhatsApp cai; fila com WhatsApp segue a regra de antes', async () => {
  const fake = { offerQueueItem: { count: async () => 0 } }
  const deps = { db: fake, isRunning: async () => false }
  assert.notEqual(await evaluateQueueGate({ id: 'q', userId: 'u', enabled: true, whatsappEnabled: true, targetJids: '["tg:-100"]' }, deps), 'bot_offline')
  assert.equal(await evaluateQueueGate({ id: 'q', userId: 'u', enabled: true, whatsappEnabled: true, targetJids: '["1@g.us","tg:-100"]' }, deps), 'bot_offline')
  assert.equal(await evaluateQueueGate({ id: 'q', userId: 'u', enabled: true, whatsappEnabled: true, targetJids: '["1@g.us"]' }, deps), 'bot_offline')
})
