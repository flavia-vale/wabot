import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../src/db.js'
import { runDeliveryOutboxTick, runDeliveryOutboxJanitorTick, OUTBOX_STATUS } from '../src/deliveryOutbox/sweep.js'

// Feature 017, Fatia 4 (T067, FR-023): a trava anti-repetição é por destino.
// O mesmo link no grupo do WhatsApp não impede o grupo do Telegram (e vice-
// versa); no MESMO grupo do Telegram, o link repetido dentro da janela não
// sai de novo. E a faxina (Telegram desligado no servidor) descarta com
// motivo o que ficou parado, sem entregar.

const LINK = 'https://s.shopee.com.br/abc'

async function setup() {
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const userId = `u-${randomUUID()}`
  await db.user.create({ data: { id: userId, name: 'T', email: `${userId}@t.local`, passwordHash: 'x', plan: 'premium', accessExpiresAt: new Date(Date.now() + 86400_000 * 30) } })
  const tg = `tg:${-1000 - Math.floor(Math.random() * 1e9)}`
  await db.group.create({ data: { userId, waJid: tg, name: 'TG', role: 'post', kind: 'group', deliveryNetwork: 'telegram' } })
  return { userId, tg }
}

const enqueue = (userId, tg, extra = {}) => db.deliveryOutbox.create({
  data: { userId, deliveryNetwork: 'telegram', destinationId: tg, offerJson: JSON.stringify({ texto: 'oferta', linkConvertido: LINK, janelaRepeticaoMs: 3600_000 }), status: 'pending', ...extra },
})

const tick = (adapter) => runDeliveryOutboxTick({ deliveryNetwork: 'telegram', db, adapter, canUseMultiNetwork: async () => true, env: {}, intervalMs: 5000 })

test('envio no WhatsApp com o mesmo link não bloqueia o Telegram', async () => {
  const { userId, tg } = await setup()
  await db.messageLog.create({ data: { userId, platform: 'shopee', sourceGroup: 'o@g.us', destGroup: '1@g.us', originalUrl: LINK, convertedUrl: LINK, messageText: 'x', status: 'success' } })
  await enqueue(userId, tg)
  const calls = []
  await tick({ send: async () => { calls.push(1); return { ok: true } } })
  assert.equal(calls.length, 1)
})

test('mesmo link no mesmo grupo do Telegram dentro da janela: não sai de novo', async () => {
  const { userId, tg } = await setup()
  await enqueue(userId, tg)
  const calls = []
  const adapter = { send: async () => { calls.push(1); return { ok: true } } }
  await tick(adapter)
  await enqueue(userId, tg)
  await tick(adapter)
  assert.equal(calls.length, 1)
  const last = await db.deliveryOutbox.findFirst({ where: { userId }, orderBy: { enqueuedAt: 'desc' } })
  assert.equal(last.lastError, 'skip:dedup_recent_link')
})

test('faxina com o Telegram desligado: o que passou da idade é descartado com motivo, nunca entregue', async () => {
  const { userId, tg } = await setup()
  await enqueue(userId, tg, { enqueuedAt: new Date(Date.now() - 5 * 3600_000) })
  const fresh = await enqueue(userId, tg)
  await runDeliveryOutboxJanitorTick({ deliveryNetwork: 'telegram', db })
  const rows = await db.deliveryOutbox.findMany({ where: { userId } })
  const old = rows.find((r) => r.id !== fresh.id)
  assert.equal(old.status, OUTBOX_STATUS.DROPPED)
  assert.equal(old.lastError, 'error:delivery:telegram:robo_indisponivel')
  assert.equal(rows.find((r) => r.id === fresh.id).status, OUTBOX_STATUS.PENDING)
  assert.equal(await db.messageLog.count({ where: { userId, status: 'success' } }), 0)
})
