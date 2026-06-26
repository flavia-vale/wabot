import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrackGuard } from '../src/api/routes/affiliateTrackGuard.js'

test('rate-limit por IP libera até o teto e bloqueia o excedente na janela', () => {
  let clock = 1_000
  const guard = createTrackGuard({ rateWindowMs: 1000, rateMax: 3, now: () => clock })
  assert.equal(guard.rateLimited('1.1.1.1'), false) // 1
  assert.equal(guard.rateLimited('1.1.1.1'), false) // 2
  assert.equal(guard.rateLimited('1.1.1.1'), false) // 3 (teto)
  assert.equal(guard.rateLimited('1.1.1.1'), true)  // 4 > teto
  // IP diferente tem balde próprio
  assert.equal(guard.rateLimited('2.2.2.2'), false)
  // após a janela, reseta
  clock += 1001
  assert.equal(guard.rateLimited('1.1.1.1'), false)
})

test('dedup bloqueia mesmo (visitor, afiliado) dentro da janela e libera depois', () => {
  let clock = 0
  const guard = createTrackGuard({ dedupMs: 5000, now: () => clock })
  assert.equal(guard.isDuplicate('v1', 'aff1'), false) // primeiro
  assert.equal(guard.isDuplicate('v1', 'aff1'), true)  // repetido
  assert.equal(guard.isDuplicate('v1', 'aff2'), false) // outro afiliado
  assert.equal(guard.isDuplicate('v2', 'aff1'), false) // outro visitor
  clock += 5001
  assert.equal(guard.isDuplicate('v1', 'aff1'), false) // janela expirou
})

test('cleanup poda entradas expiradas dos dois mapas', () => {
  let clock = 0
  const guard = createTrackGuard({ rateWindowMs: 1000, dedupMs: 1000, now: () => clock })
  guard.rateLimited('1.1.1.1')
  guard.isDuplicate('v1', 'aff1')
  assert.deepEqual(guard._sizes(), { ips: 1, dedup: 1 })
  clock += 2000
  guard.cleanup()
  assert.deepEqual(guard._sizes(), { ips: 0, dedup: 0 })
})
