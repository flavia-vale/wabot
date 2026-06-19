import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildRedisOptions, defaultRetryStrategy, createRedisConnection, CANONICAL_REDIS_OPTIONS } from '../src/core/redisFactory.js'

test('defaultRetryStrategy faz backoff limitado a 5s', () => {
  assert.equal(defaultRetryStrategy(1), 200)
  assert.equal(defaultRetryStrategy(5), 1000)
  assert.equal(defaultRetryStrategy(1000), 5000) // teto
  assert.equal(defaultRetryStrategy(0), 200) // normaliza times<1
})

test('buildRedisOptions injeta defaults canônicos + connectionName', () => {
  const opts = buildRedisOptions('probe-pub')
  assert.equal(opts.connectTimeout, 10_000)
  assert.equal(typeof opts.retryStrategy, 'function')
  assert.equal(opts.connectionName, 'wabot:probe-pub')
})

test('overrides têm precedência sobre os defaults', () => {
  const opts = buildRedisOptions('ops', { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 500 })
  assert.equal(opts.maxRetriesPerRequest, 1)
  assert.equal(opts.lazyConnect, true)
  assert.equal(opts.connectTimeout, 500) // override venceu o default
})

test('connectionName explícito não é sobrescrito pelo role', () => {
  const opts = buildRedisOptions('role-x', { connectionName: 'custom' })
  assert.equal(opts.connectionName, 'custom')
})

test('sem role não força connectionName', () => {
  const opts = buildRedisOptions()
  assert.equal(opts.connectionName, undefined)
})

test('CANONICAL_REDIS_OPTIONS é imutável e não inclui maxRetriesPerRequest/lazyConnect', () => {
  assert.equal('maxRetriesPerRequest' in CANONICAL_REDIS_OPTIONS, false)
  assert.equal('lazyConnect' in CANONICAL_REDIS_OPTIONS, false)
  assert.throws(() => { CANONICAL_REDIS_OPTIONS.connectTimeout = 1 })
})

test('createRedisConnection usa o ctor injetado e as opções montadas', async () => {
  const calls = []
  class FakeRedis {
    constructor(url, opts) { calls.push({ url, opts }) }
  }
  await createRedisConnection('redis://x', { role: 'test', RedisCtor: FakeRedis, lazyConnect: false })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'redis://x')
  assert.equal(calls[0].opts.connectionName, 'wabot:test')
  assert.equal(calls[0].opts.lazyConnect, false)
  assert.equal(typeof calls[0].opts.retryStrategy, 'function')
})
