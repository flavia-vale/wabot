import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCachedProbe, setCachedProbe, pruneExpired, invalidateCachedProbe } from '../src/converters/mercadolivreSessionProbeCache.js'

function withTtlMs(ms, fn) {
  const prev = process.env.ML_SESSION_PROBE_CACHE_TTL_MS
  process.env.ML_SESSION_PROBE_CACHE_TTL_MS = String(ms)
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.ML_SESSION_PROBE_CACHE_TTL_MS
    else process.env.ML_SESSION_PROBE_CACHE_TTL_MS = prev
  }
}

test('getCachedProbe: miss inicial retorna null', () => {
  assert.equal(getCachedProbe('ml-cache-user-miss'), null)
})

test('setCachedProbe/getCachedProbe: hit dentro do TTL retorna o resultado salvo sem recomputar', () => {
  const now = 1_000_000
  const result = { configured: true, alive: true, reason: 'ok' }
  setCachedProbe('ml-cache-user-hit', result, now)
  assert.deepEqual(getCachedProbe('ml-cache-user-hit', now + 1000), result)
})

test('getCachedProbe: após expirar o TTL não serve mais o valor antigo', () => {
  withTtlMs(1000, () => {
    const now = 1_000_000
    setCachedProbe('ml-cache-user-expire', { alive: true, reason: 'ok' }, now)
    assert.equal(getCachedProbe('ml-cache-user-expire', now + 1500), null)
  })
})

test('pruneExpired: remove entradas expiradas sem afetar as válidas', () => {
  const now = 1_000_000
  withTtlMs(500, () => setCachedProbe('ml-cache-user-prune-expired', { alive: false, reason: 'expired-entry' }, now))
  withTtlMs(10_000, () => setCachedProbe('ml-cache-user-prune-valid', { alive: true, reason: 'valid-entry' }, now))

  pruneExpired(now + 1000)

  assert.equal(getCachedProbe('ml-cache-user-prune-expired', now + 1000), null)
  assert.deepEqual(getCachedProbe('ml-cache-user-prune-valid', now + 1000), { alive: true, reason: 'valid-entry' })
})

test('setCachedProbe: alive:null (transitório) NÃO é armazenado — próxima leitura continua sendo miss', () => {
  const now = 1_000_000
  setCachedProbe('ml-cache-user-transient', { configured: true, alive: null, reason: 'network_error' }, now)
  assert.equal(getCachedProbe('ml-cache-user-transient', now), null)
})

test('invalidateCachedProbe: remove a entrada de um userId específico sem afetar outros', () => {
  const now = 1_000_000
  setCachedProbe('ml-cache-user-invalidate-a', { alive: true, reason: 'ok' }, now)
  setCachedProbe('ml-cache-user-invalidate-b', { alive: true, reason: 'ok' }, now)

  invalidateCachedProbe('ml-cache-user-invalidate-a')

  assert.equal(getCachedProbe('ml-cache-user-invalidate-a', now), null)
  assert.deepEqual(getCachedProbe('ml-cache-user-invalidate-b', now), { alive: true, reason: 'ok' })
})

test('TTL configurável via env ML_SESSION_PROBE_CACHE_TTL_MS', () => {
  withTtlMs(200, () => {
    const now = 5000
    setCachedProbe('ml-cache-user-custom-ttl', { alive: true, reason: 'ok' }, now)
    assert.deepEqual(getCachedProbe('ml-cache-user-custom-ttl', now + 199), { alive: true, reason: 'ok' })
    assert.equal(getCachedProbe('ml-cache-user-custom-ttl', now + 201), null)
  })
})
