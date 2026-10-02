import test from 'node:test'
import assert from 'node:assert/strict'
import { planOutboxTick } from '../src/core/delivery/fairShare.js'

// Feature 017, T061 (FR-039/FR-040/SC-013).

const row = (id, userId, destinationId, at) => ({ id, userId, destinationId, enqueuedAt: new Date(at) })

test('conta em volume alto não consome a vez das outras', () => {
  const rows = [
    ...Array.from({ length: 50 }, (_, i) => row(`a${i}`, 'A', `tg:${i}`, 1000 + i)),
    row('b1', 'B', 'tg:b', 5000),
    row('c1', 'C', 'tg:c', 6000),
  ]
  const { send } = planOutboxTick(rows, { perUserCap: 5, globalBudget: 100 })
  const perUser = send.reduce((m, r) => ({ ...m, [r.userId]: (m[r.userId] ?? 0) + 1 }), {})
  assert.equal(perUser.A, 5)
  assert.equal(perUser.B, 1)
  assert.equal(perUser.C, 1)
})

test('no máximo uma entrega por grupo por passada, na ordem de chegada', () => {
  const rows = [row('1', 'A', 'tg:x', 1), row('2', 'A', 'tg:x', 2), row('3', 'A', 'tg:y', 3)]
  const { send } = planOutboxTick(rows, { perUserCap: 5, globalBudget: 100 })
  assert.deepEqual(send.map((r) => r.id), ['1', '3'])
})

test('orçamento global estourado: adia com data futura, nunca descarta', () => {
  const now = 1_000_000
  const rows = ['A', 'B', 'C', 'D'].map((u, i) => row(u, u, `tg:${u}`, i))
  const { send, deferred } = planOutboxTick(rows, { perUserCap: 5, globalBudget: 2, now, retryInMs: 5000 })
  assert.equal(send.length, 2)
  assert.ok(deferred.length >= 1)
  for (const d of deferred) assert.ok(d.notBeforeAt.getTime() > now)
  const all = new Set([...send.map((r) => r.id), ...deferred.map((d) => d.row.id)])
  assert.ok(all.size <= 4)
})

test('sem orçamento conhecido: ritmo conservador (1 por conta), sem travar ninguém', () => {
  const rows = [row('1', 'A', 'tg:1', 1), row('2', 'A', 'tg:2', 2), row('3', 'B', 'tg:3', 3)]
  const { send, deferred } = planOutboxTick(rows, { perUserCap: 5, globalBudget: null })
  assert.deepEqual(send.map((r) => r.id).sort(), ['1', '3'])
  assert.equal(deferred.length, 0)
})
