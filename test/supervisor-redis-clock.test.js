import test from 'node:test'
import assert from 'node:assert/strict'
import { createRedisClock, parseRedisTime } from '../src/supervisor/redisClock.js'
import { isCommandStale } from '../src/supervisor/protocol.js'

test('parseRedisTime converte [s, µs] em epoch ms e rejeita lixo', () => {
  assert.equal(parseRedisTime(['1700000000', '123456']), 1700000000123)
  assert.equal(parseRedisTime(null), null)
  assert.equal(parseRedisTime(['x', '1']), null)
  assert.equal(parseRedisTime(['1']), null)
})

test('relógio do Redis absorve o desvio da máquina local', async () => {
  const local = { t: 1_000_000 }
  const clock = createRedisClock({
    localNow: () => local.t,
    time: async () => [String(Math.floor((local.t + 10_000) / 1000)), String(((local.t + 10_000) % 1000) * 1000)], // Redis 10 s à frente
  })
  assert.equal(await clock.now(), local.t + 10_000)
  assert.equal(clock.getOffsetMs(), 10_000)
})

test('desvio é cacheado: não consulta o Redis a cada chamada', async () => {
  let calls = 0
  const local = { t: 5_000_000 }
  const clock = createRedisClock({ localNow: () => local.t, ttlMs: 60_000, time: async () => { calls++; return [String(local.t / 1000), '0'] } })
  await clock.now(); await clock.now(); await clock.now()
  assert.equal(calls, 1)
  local.t += 61_000
  await clock.now()
  assert.equal(calls, 2)
})

test('Redis falhando mantém o último desvio (0 na primeira vez) e nunca lança', async () => {
  const clock = createRedisClock({ localNow: () => 42, time: async () => { throw new Error('fora') } })
  assert.equal(await clock.now(), 42)
})

test('MN-04: com dois servidores com 8 s de diferença, START_BOT não vira "obsoleto" na régua do Redis', async () => {
  // API 8 s ATRASADA em relação ao supervisor; ambos medem contra o mesmo Redis.
  const redisReal = 10_000_000
  const api = createRedisClock({ localNow: () => redisReal - 8_000, time: async () => [String(redisReal / 1000), '0'] })
  const sup = createRedisClock({ localNow: () => redisReal, time: async () => [String(redisReal / 1000), '0'] })
  const enqueuedAt = await api.now()
  assert.equal(isCommandStale('startBot', enqueuedAt, await sup.now()), false)
  // Sem a régua comum, a mesma diferença descartaria o comando:
  assert.equal(isCommandStale('startBot', redisReal - 8_000, redisReal), true)
})
