import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import db from '../src/db.js'
import { logsRoutes } from '../src/api/routes/logs.js'
import { senderNumberLabel } from '../dashboard/lib/painel/logsCopy.js'

// Vários números por conta: a aba Envios mostra qual número enviou cada
// mensagem (MessageLog.senderSlot → telefone daquele número).

test('rótulo do número: telefone formatado, "Número N" sem telefone, "—" sem dado', () => {
  const nums = { 1: '5532998393521', 2: '553299844020' }
  assert.equal(senderNumberLabel({ senderSlot: 2 }, nums), '(32) 9984-4020')
  assert.equal(senderNumberLabel({ senderSlot: 1 }, nums), '(32) 99839-3521')
  assert.equal(senderNumberLabel({ senderSlot: 2 }, { 1: '5532998393521', 2: null }), 'Número 2')
  assert.equal(senderNumberLabel({ senderSlot: null }, nums), '—')
  assert.equal(senderNumberLabel({ senderSlot: 1 }, null), '—')
})

async function build({ extraNumbers, activeWaSlot = 1 }) {
  const userId = `user-envios-num-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id: userId, name: 'E', email: `${userId}@t.local`, passwordHash: 'x', extraNumbers, activeWaSlot } })
  await db.waSession.create({ data: { userId, status: 'connected', phone: '553299844020' } })
  if (extraNumbers) await db.waExtraSession.create({ data: { userId, slot: 2, status: 'connected', phone: '5532998393521' } })
  await db.messageLog.create({ data: { userId, platform: 'shopee', sourceGroup: 'o@g.us', destGroup: 'd@g.us', originalUrl: 'x', convertedUrl: 'y', messageText: 'oferta', status: 'success', sentAt: new Date(), senderSlot: 2 } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async req => { req.user = { sub: userId } })
  await app.register(logsRoutes)
  return { app, userId }
}

test('API de Envios: telefones por número só para conta com número extra', async () => {
  // Número 2 envia agora: o telefone de WaSession é o do número 2.
  const multi = await build({ extraNumbers: 1, activeWaSlot: 2 })
  const single = await build({ extraNumbers: 0 })
  try {
    const res = (await multi.app.inject({ method: 'GET', url: '/' })).json()
    assert.deepEqual(res.senderNumbers, { 1: '5532998393521', 2: '553299844020' })
    assert.equal(res.logs[0].senderSlot, 2)
    assert.equal((await single.app.inject({ method: 'GET', url: '/' })).json().senderNumbers, null)
  } finally {
    await db.user.deleteMany({ where: { id: { in: [multi.userId, single.userId] } } })
  }
})

test('tela de Envios: coluna "Número" só aparece com senderNumbers (desktop e celular)', () => {
  const src = readFileSync(new URL('../dashboard/app/painel/envios/SendHistory.js', import.meta.url), 'utf8')
  assert.match(src, /\{senderNumbers && <th>Número<\/th>\}/)
  assert.match(src, /\{senderNumbers && <td[^>]*>\{senderNumberLabel\(log, senderNumbers\)\}<\/td>\}/)
  assert.match(src, /senderNumbers \? ` · \$\{senderNumberLabel\(log, senderNumbers\)\}` : ''/)
})
