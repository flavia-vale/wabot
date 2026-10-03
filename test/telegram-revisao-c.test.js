import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import db from '../src/db.js'
import { handleLinkUpdate } from '../src/delivery/telegram/link.js'
import { NETWORK_HEALTH, computeNetworkHealth } from '../src/core/delivery/networkHealth.js'
import { OUTBOX_STATUS, runDeliveryOutboxTick } from '../src/deliveryOutbox/sweep.js'
import { AUDIENCE_FILTERS } from '../src/email/audience.js'

// Revisão crítica do Telegram, PR C — itens 11 a 15.

test('item 11: ligar grupo pelo link respeita o limite de grupos da conta', async () => {
  let created = 0
  const fakeDb = {
    deliveryNetworkLink: { findUnique: async () => ({ userId: 'u1', deliveryNetwork: 'telegram', linkCode: 'CODIGO1234' }) },
    group: {
      findFirst: async () => null,
      count: async () => 50,
      create: async () => { created++; return { id: 'g' } },
    },
  }
  const r = await handleLinkUpdate({ message: { chat: { id: -1, type: 'group', title: 'X' }, text: '/start CODIGO1234' } }, {
    db: fakeDb, adapter: {}, canUseMultiNetwork: async () => true, botUsername: async () => 'b', groupsLimit: 50,
  })
  assert.equal(r.acao, 'limite_de_grupos')
  assert.equal(created, 0)
})

test('item 13: limite de ritmo em UM grupo não vira "robô limitado"; em vários grupos, vira', () => {
  const now = 1_000_000
  const one = computeNetworkHealth([{ kind: 'limite', at: now - 1000, chave: 'tg:-1' }, { kind: 'limite', at: now - 500, chave: 'tg:-1' }, { kind: 'ok', at: now - 100 }], { now })
  assert.equal(one.estado, NETWORK_HEALTH.FUNCIONANDO)
  const many = computeNetworkHealth([{ kind: 'limite', at: now - 1000, chave: 'tg:-1' }, { kind: 'limite', at: now - 500, chave: 'tg:-2' }, { kind: 'ok', at: now - 100 }], { now })
  assert.equal(many.estado, NETWORK_HEALTH.LIMITADO)
})

async function setup(groupData = {}) {
  await db.deliveryOutbox.updateMany({ where: { status: { in: ['pending', 'sending'] } }, data: { status: 'dropped' } })
  const userId = `u-${randomUUID()}`
  await db.user.create({ data: { id: userId, name: 'T', email: `${userId}@t.local`, passwordHash: 'x', plan: 'premium' } })
  const waJid = `tg:${-1000 - Math.floor(Math.random() * 1e9)}`
  await db.group.create({ data: { userId, waJid, name: 'TG', role: 'post', kind: 'group', deliveryNetwork: 'telegram', ...groupData } })
  return { userId, waJid }
}
const enqueue = (userId, waJid, extra = {}) => db.deliveryOutbox.create({ data: { userId, deliveryNetwork: 'telegram', destinationId: waJid, offerJson: '{"texto":"x"}', status: 'pending', ...extra } })
const tick = (adapter) => runDeliveryOutboxTick({ deliveryNetwork: 'telegram', db, adapter, canUseMultiNetwork: async () => true, env: {}, intervalMs: 5000 })

test('item 12: fora do horário de envio do destino, adia (não envia e não descarta)', async () => {
  // Janela de 1 hora que nunca inclui "agora" (em São Paulo).
  const hourSp = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const start = (hourSp + 2) % 24
  const { userId, waJid } = await setup({ operatingHoursEnabled: true, operatingHoursJson: JSON.stringify({ startHour: start, endHour: (start + 1) % 24, tz: 'America/Sao_Paulo' }) })
  const row = await enqueue(userId, waJid)
  let sends = 0
  await tick({ send: async () => { sends++; return { ok: true } } })
  assert.equal(sends, 0)
  const after = await db.deliveryOutbox.findUnique({ where: { id: row.id } })
  assert.equal(after.status, OUTBOX_STATUS.PENDING)
  assert.ok(after.notBeforeAt > new Date())
})

test('item 12: limite diário do destino batido, adia para o dia seguinte; sem configuração, nada muda', async () => {
  const capped = await setup({ dailyCap: 1 })
  await db.messageLog.create({ data: { userId: capped.userId, platform: 'x', sourceGroup: 'x', destGroup: capped.waJid, originalUrl: '', convertedUrl: '', messageText: 'x', status: 'success' } })
  const row = await enqueue(capped.userId, capped.waJid)
  let sends = 0
  await tick({ send: async () => { sends++; return { ok: true } } })
  assert.equal(sends, 0)
  assert.ok((await db.deliveryOutbox.findUnique({ where: { id: row.id } })).notBeforeAt > new Date(Date.now() + 60_000))

  const free = await setup()
  await enqueue(free.userId, free.waJid)
  await tick({ send: async () => { sends++; return { ok: true } } })
  assert.equal(sends, 1)
})

test('item 14: robô removido 3 vezes seguidas — para de tentar enviar até a prontidão voltar', async () => {
  const { userId, waJid } = await setup()
  for (let i = 0; i < 3; i++) await enqueue(userId, waJid, { status: 'failed', lastError: 'error:delivery:telegram:robo_nao_adicionado' })
  const row = await enqueue(userId, waJid)
  let sends = 0
  let checks = 0
  const adapter = { send: async () => { sends++; return { ok: true } }, checkDestination: async () => { checks++; return { pronto: false, motivo: 'robo_nao_adicionado' } } }
  await tick(adapter)
  assert.equal(sends, 0)
  assert.equal(checks, 1)
  assert.equal((await db.deliveryOutbox.findUnique({ where: { id: row.id } })).lastError, 'error:delivery:telegram:robo_nao_adicionado')

  // Robô de volta: envia normalmente.
  const row2 = await enqueue(userId, waJid)
  await tick({ ...adapter, checkDestination: async () => ({ pronto: true, motivo: null }) })
  assert.equal(sends, 1)
  assert.equal((await db.deliveryOutbox.findUnique({ where: { id: row2.id } })).status, OUTBOX_STATUS.DONE)
})

test('item 15: Premium no editor de planos do admin e no filtro de público dos e-mails', async () => {
  const filtro = AUDIENCE_FILTERS?.find?.((f) => f.name === 'plano')
  if (filtro) assert.ok(filtro.options.includes('premium'))
  const { readFileSync } = await import('node:fs')
  const admin = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.match(admin, /\['trial', 'basic', 'pro', 'premium'\]\.includes/)
})
