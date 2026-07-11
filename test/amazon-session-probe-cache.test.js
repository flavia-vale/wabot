import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCachedProbe, setCachedProbe, pruneExpired } from '../src/converters/amazonSessionProbeCache.js'

function withTtlMs(ms, fn) {
  const prev = process.env.AMAZON_SESSION_PROBE_CACHE_TTL_MS
  process.env.AMAZON_SESSION_PROBE_CACHE_TTL_MS = String(ms)
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.AMAZON_SESSION_PROBE_CACHE_TTL_MS
    else process.env.AMAZON_SESSION_PROBE_CACHE_TTL_MS = prev
  }
}

test('getCachedProbe: miss inicial retorna null', () => {
  assert.equal(getCachedProbe('cache-user-miss'), null)
})

test('setCachedProbe/getCachedProbe: hit dentro do TTL retorna o resultado salvo sem recomputar', () => {
  const now = 1_000_000
  const result = { configured: true, alive: true, reason: 'ok' }
  setCachedProbe('cache-user-hit', result, now)
  assert.deepEqual(getCachedProbe('cache-user-hit', now + 1000), result)
})

test('getCachedProbe: após expirar o TTL não serve mais o valor antigo', () => {
  withTtlMs(1000, () => {
    const now = 1_000_000
    setCachedProbe('cache-user-expire', { reason: 'ok' }, now)
    assert.equal(getCachedProbe('cache-user-expire', now + 1500), null)
  })
})

test('pruneExpired: remove entradas expiradas sem afetar as válidas', () => {
  const now = 1_000_000
  withTtlMs(500, () => setCachedProbe('cache-user-prune-expired', { reason: 'expired-entry' }, now))
  withTtlMs(10_000, () => setCachedProbe('cache-user-prune-valid', { reason: 'valid-entry' }, now))

  pruneExpired(now + 1000)

  assert.equal(getCachedProbe('cache-user-prune-expired', now + 1000), null)
  assert.deepEqual(getCachedProbe('cache-user-prune-valid', now + 1000), { reason: 'valid-entry' })
})

test('TTL configurável via env AMAZON_SESSION_PROBE_CACHE_TTL_MS', () => {
  withTtlMs(200, () => {
    const now = 5000
    setCachedProbe('cache-user-custom-ttl', { reason: 'ok' }, now)
    assert.deepEqual(getCachedProbe('cache-user-custom-ttl', now + 199), { reason: 'ok' })
    assert.equal(getCachedProbe('cache-user-custom-ttl', now + 201), null)
  })
})
