import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../src/db.js'
import { OUTBOX_STATUS, runDeliveryOutboxTick } from '../src/deliveryOutbox/sweep.js'
import { parseDeliveryReductions } from '../src/core/delivery/neutralOffer.js'
import { createHealthRecorder } from '../src/core/delivery/networkHealth.js'

// Feature 017, T052/T054/T059 (com banco): a caixa de saída do Telegram.
// - robô fora do ar: a linha continua pendente, sem rajada de tentativas,
//   nada vira "entregue" sem entrega (FR-040);
// - falha de um item não aborta o lote nem desfaz o que já saiu (FR-024);
// - botão "Ver canal" sai removido e a redução fica no histórico (FR-009);
// - plano rebaixado: para de publicar sem apagar nenhum grupo; ao voltar,
//   funciona sem reconfigurar (SC-015);
// - linhas antigas concluídas são podadas.

async function setup() {
  // Isola cada caso: pendências de casos anteriores (banco de teste) não
  // entram na passada deste.
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const userId = `u-${randomUUID()}`
  await db.user.create({ data: { id: userId, name: 'Teste TG', email: `${userId}@test.local`, passwordHash: 'x', plan: 'premium', accessExpiresAt: new Date(Date.now() + 30 * 86400_000) } })
  // Identificadores únicos por teste: o ritmo por grupo é global (o mesmo
  // grupo do Telegram é o mesmo para qualquer conta).
  const base = -1000 - Math.floor(Math.random() * 1e9)
  const ids = [base, base - 1, base - 2].map((n) => `tg:${n}`)
  const groups = []
  for (const waJid of ids) {
    groups.push(await db.group.create({ data: { userId, waJid, name: waJid, role: 'post', kind: 'group', deliveryNetwork: 'telegram' } }))
  }
  return { userId, groups, ids }
}

async function enqueue(userId, destinationId, offer = {}, extra = {}) {
  return db.deliveryOutbox.create({
    data: { userId, deliveryNetwork: 'telegram', destinationId, offerJson: JSON.stringify({ texto: 'Oferta', linkConvertido: 'https://s.shopee.com.br/x', ...offer }), status: 'pending', ...extra },
  })
}

function fakeAdapter(behaviour) {
  const calls = []
  return {
    calls,
    send: async (oferta, destino) => { calls.push({ oferta, destino }); return behaviour(destino, oferta) },
  }
}

const tick = (deps) => runDeliveryOutboxTick({ deliveryNetwork: 'telegram', db, canUseMultiNetwork: async () => true, env: {}, intervalMs: 5000, ...deps })

test('robô fora do ar: continua pendente, tick para cedo, nada vira entregue', async () => {
  const { userId, ids } = await setup()
  const rows = [await enqueue(userId, ids[0]), await enqueue(userId, ids[1]), await enqueue(userId, ids[2])]
  const adapter = fakeAdapter(() => ({ ok: false, motivo: 'robo_indisponivel', temporario: true, retryAfterSec: 60, sinal: 'indisponivel' }))
  const health = createHealthRecorder()
  const summary = await tick({ adapter, health })
  assert.equal(summary.paradoCedo, true)
  assert.ok(adapter.calls.length <= rows.length)
  assert.equal(adapter.calls.length, 1, 'uma tentativa só, não rajada')
  const after = await db.deliveryOutbox.findMany({ where: { userId } })
  for (const r of after) {
    assert.equal(r.status, OUTBOX_STATUS.PENDING)
  }
  assert.equal(await db.messageLog.count({ where: { userId, status: 'success' } }), 0)
  assert.equal(health.signals('telegram')[0].kind, 'indisponivel')
})

test('falha de um item não aborta o lote; sucesso grava histórico com o aplicativo', async () => {
  const { userId, ids } = await setup()
  await enqueue(userId, ids[0])
  await enqueue(userId, ids[1])
  await enqueue(userId, ids[2])
  const adapter = fakeAdapter((destino) => {
    if (destino === ids[1]) throw new Error('explodiu')
    if (destino === ids[2]) return { ok: false, motivo: 'robo_nao_adicionado', temporario: false }
    return { ok: true }
  })
  await tick({ adapter })
  const byDest = Object.fromEntries((await db.deliveryOutbox.findMany({ where: { userId } })).map((r) => [r.destinationId, r]))
  assert.equal(byDest[ids[0]].status, OUTBOX_STATUS.DONE)
  assert.equal(byDest[ids[1]].status, OUTBOX_STATUS.PENDING)
  assert.equal(byDest[ids[2]].status, OUTBOX_STATUS.FAILED)
  const logs = await db.messageLog.findMany({ where: { userId } })
  const ok = logs.find((l) => l.destGroup === ids[0])
  assert.equal(ok.status, 'success')
  assert.equal(ok.deliveryNetwork, 'telegram')
  const failed = logs.find((l) => l.destGroup === ids[2])
  assert.equal(failed.errorMsg, 'error:delivery:telegram:robo_nao_adicionado')
})

test('botão "Ver canal" sai removido e a redução fica registrada', async () => {
  const { userId, ids } = await setup()
  await enqueue(userId, ids[0], { botao: { jid: '1@newsletter', nome: 'Canal' } })
  const adapter = fakeAdapter(() => ({ ok: true }))
  await tick({ adapter })
  assert.equal(adapter.calls[0].oferta.botao, undefined)
  const log = await db.messageLog.findFirst({ where: { userId } })
  assert.deepEqual(parseDeliveryReductions(log.deliveryReductions), ['botao_removido'])
})

test('plano rebaixado: para sem apagar grupo; ao voltar, publica sem reconfigurar', async () => {
  const { userId, groups, ids } = await setup()
  await enqueue(userId, ids[0])
  const adapter = fakeAdapter(() => ({ ok: true }))
  await tick({ adapter, canUseMultiNetwork: async () => false })
  assert.equal(adapter.calls.length, 0)
  const dropped = await db.deliveryOutbox.findFirst({ where: { userId } })
  assert.equal(dropped.status, OUTBOX_STATUS.DROPPED)
  assert.equal(dropped.lastError, 'error:delivery:telegram:plano_pausado')
  assert.equal(await db.group.count({ where: { userId, deliveryNetwork: 'telegram' } }), groups.length)

  await enqueue(userId, ids[0])
  await tick({ adapter, canUseMultiNetwork: async () => true })
  assert.equal(adapter.calls.length, 1)
})

test('aplicativo desligado pela cliente: não publica; grupo continua', async () => {
  const { userId, ids } = await setup()
  await db.deliveryNetworkLink.create({ data: { userId, deliveryNetwork: 'telegram', linkCode: randomUUID(), disabledAt: new Date() } })
  await enqueue(userId, ids[0])
  const adapter = fakeAdapter(() => ({ ok: true }))
  await tick({ adapter })
  assert.equal(adapter.calls.length, 0)
  assert.equal((await db.deliveryOutbox.findFirst({ where: { userId } })).lastError, 'error:delivery:telegram:aplicativo_desligado')
})

test('oferta velha demais é descartada com motivo; linhas antigas concluídas são podadas', async () => {
  const { userId, ids } = await setup()
  await enqueue(userId, ids[0], {}, { enqueuedAt: new Date(Date.now() - 5 * 3600_000) })
  const old = await enqueue(userId, ids[1], {}, { status: 'done' })
  await db.$executeRawUnsafe('UPDATE "DeliveryOutbox" SET "updatedAt" = ? WHERE id = ?', new Date(Date.now() - 8 * 86400_000), old.id)
  const adapter = fakeAdapter(() => ({ ok: true }))
  await tick({ adapter })
  assert.equal(adapter.calls.length, 0)
  const rows = await db.deliveryOutbox.findMany({ where: { userId } })
  assert.equal(rows.length, 1)
  assert.match(rows[0].lastError, /^skip:queue_expired/)
})

test('limite de ritmo: adia com data futura, continua pendente', async () => {
  const { userId, ids } = await setup()
  await enqueue(userId, ids[0])
  const adapter = fakeAdapter(() => ({ ok: false, motivo: 'limite_de_ritmo', temporario: true, retryAfterSec: 20, sinal: 'limite' }))
  await tick({ adapter })
  const r = await db.deliveryOutbox.findFirst({ where: { userId } })
  assert.equal(r.status, OUTBOX_STATUS.PENDING)
  assert.ok(r.notBeforeAt.getTime() > Date.now() + 10_000)
  await tick({ adapter })
  assert.equal(adapter.calls.length, 1, 'não tenta antes da hora')
})
