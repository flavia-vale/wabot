import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../src/db.js'
import { OUTBOX_STATUS, runDeliveryOutboxTick } from '../src/deliveryOutbox/sweep.js'

// Revisão crítica do Telegram, item 4 (com banco): oferta que o Telegram já
// aceitou NUNCA volta para a fila — nem com o banco ocupado na hora de gravar
// "entregue", nem depois de o servidor cair no meio do envio.

async function setup() {
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const userId = `u-${randomUUID()}`
  await db.user.create({ data: { id: userId, name: 'T', email: `${userId}@t.local`, passwordHash: 'x', plan: 'premium' } })
  const tg = `tg:${-1000 - Math.floor(Math.random() * 1e9)}`
  await db.group.create({ data: { userId, waJid: tg, name: 'TG', role: 'post', kind: 'group', deliveryNetwork: 'telegram' } })
  const row = await db.deliveryOutbox.create({ data: { userId, deliveryNetwork: 'telegram', destinationId: tg, offerJson: JSON.stringify({ texto: 'oferta' }), status: 'pending' } })
  return { userId, tg, row }
}

const tick = (adapter, database = db) => runDeliveryOutboxTick({ deliveryNetwork: 'telegram', db: database, adapter, canUseMultiNetwork: async () => true, env: {}, intervalMs: 5000 })

// Banco que falha SEMPRE ao gravar "entregue" (pior caso de banco ocupado).
function dbFailingDone() {
  return new Proxy(db, {
    get(target, prop) {
      if (prop !== 'deliveryOutbox') return target[prop]
      return new Proxy(target.deliveryOutbox, {
        get(t, p) {
          if (p !== 'update') return typeof t[p] === 'function' ? t[p].bind(t) : t[p]
          return async (args) => {
            if (args?.data?.status === OUTBOX_STATUS.DONE) throw new Error('SQLITE_BUSY')
            return t.update(args)
          }
        },
      })
    },
  })
}

test('banco ocupado ao gravar "entregue": a oferta não é reenviada nas passadas seguintes', async () => {
  const { row } = await setup()
  let sends = 0
  const adapter = { send: async () => { sends++; return { ok: true } } }
  const flaky = dbFailingDone()
  await tick(adapter, flaky)
  await tick(adapter, flaky)
  await tick(adapter, flaky)
  assert.equal(sends, 1)
  const after = await db.deliveryOutbox.findUnique({ where: { id: row.id } })
  assert.notEqual(after.status, OUTBOX_STATUS.PENDING)
})

test('"enviando" preso (servidor caiu no meio): vira entrega incerta, sem reenvio', async () => {
  const { userId, row } = await setup()
  await db.deliveryOutbox.update({ where: { id: row.id }, data: { status: OUTBOX_STATUS.SENDING } })
  await db.$executeRawUnsafe('UPDATE "DeliveryOutbox" SET "updatedAt" = ? WHERE id = ?', new Date(Date.now() - 11 * 60_000), row.id)
  let sends = 0
  await tick({ send: async () => { sends++; return { ok: true } } })
  assert.equal(sends, 0)
  const after = await db.deliveryOutbox.findUnique({ where: { id: row.id } })
  assert.equal(after.status, OUTBOX_STATUS.FAILED)
  assert.equal(after.lastError, 'error:delivery:telegram:entrega_incerta')
  const log = await db.messageLog.findFirst({ where: { userId } })
  assert.equal(log.errorMsg, 'error:delivery:telegram:entrega_incerta')
})

test('falha ANTES do envio continua voltando para a fila (nada se perde)', async () => {
  const { row } = await setup()
  const broken = new Proxy(db, {
    get(target, prop) {
      if (prop === 'deliveryNetworkLink') return { findUnique: async () => { throw new Error('banco fora') } }
      return target[prop]
    },
  })
  await tick({ send: async () => ({ ok: true }) }, broken)
  const after = await db.deliveryOutbox.findUnique({ where: { id: row.id } })
  assert.equal(after.status, OUTBOX_STATUS.PENDING)
  assert.ok(after.notBeforeAt > new Date())
})
