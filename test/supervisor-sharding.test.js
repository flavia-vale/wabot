import test from 'node:test'
import assert from 'node:assert/strict'
import { buildShardTag, computeShardIndex, normalizeShardCount, shouldHandleUserOnShard } from '../src/supervisor/sharding.js'

test('normalizeShardCount aplica fallback seguro', () => {
  assert.equal(normalizeShardCount(undefined, 2), 2)
  assert.equal(normalizeShardCount('3'), 3)
  assert.equal(normalizeShardCount(0, 2), 2)
})

test('computeShardIndex é determinístico', () => {
  const a = computeShardIndex('user-123', 8)
  const b = computeShardIndex('user-123', 8)
  assert.equal(a, b)
  assert.ok(a >= 0 && a < 8)
})

test('buildShardTag cria tag canônica', () => {
  const tag = buildShardTag('user-123', 4)
  assert.match(tag, /^shard-[1-4]-of-4$/)
})

test('shouldHandleUserOnShard respeita índice', () => {
  const idx = computeShardIndex('abc', 4)
  assert.equal(shouldHandleUserOnShard('abc', 4, idx), true)
  assert.equal(shouldHandleUserOnShard('abc', 4, (idx + 1) % 4), false)
})
