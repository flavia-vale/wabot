import test from 'node:test'
import assert from 'node:assert/strict'
import { planOutboxTick } from '../src/core/delivery/fairShare.js'

// Feature 017, Fatia 6 (T084, SC-013): várias contas disputando o orçamento
// do robô. A conta em volume alto não atrasa as contas em volume normal: ao
// longo das passadas, cada conta normal é atendida na primeira passada.

test('simulação: 1 conta com 500 ofertas e 20 contas com 2 cada', () => {
  let rows = []
  let t = 0
  for (let i = 0; i < 500; i++) rows.push({ id: `big-${i}`, userId: 'big', destinationId: `tg:big-${i % 10}`, enqueuedAt: new Date(t++) })
  for (let u = 0; u < 20; u++) for (let i = 0; i < 2; i++) rows.push({ id: `n${u}-${i}`, userId: `n${u}`, destinationId: `tg:n${u}-${i}`, enqueuedAt: new Date(t++) })

  const firstServedAt = new Map()
  for (let tick = 0; tick < 200 && rows.length; tick++) {
    const { send } = planOutboxTick(rows, { perUserCap: 5, globalBudget: 125 })
    for (const r of send) if (!firstServedAt.has(r.userId)) firstServedAt.set(r.userId, tick)
    const sent = new Set(send.map((r) => r.id))
    rows = rows.filter((r) => !sent.has(r.id))
  }
  for (let u = 0; u < 20; u++) assert.equal(firstServedAt.get(`n${u}`), 0, `conta n${u} esperou`)
  // Nas duas primeiras passadas, todas as contas normais terminaram.
  assert.ok(!rows.some((r) => r.userId !== 'big'))
})
