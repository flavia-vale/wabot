import crypto from 'crypto'

export function normalizeShardCount(value, fallback = 1) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.max(1, Math.floor(n))
}

export function computeShardIndex(userId, shardCount) {
  const count = normalizeShardCount(shardCount, 1)
  const key = String(userId || '')
  if (!key) return 0
  const digest = crypto.createHash('sha1').update(key).digest()
  const hash32 = digest.readUInt32BE(0)
  return hash32 % count
}

export function buildShardTag(userId, shardCount) {
  const count = normalizeShardCount(shardCount, 1)
  const idx = computeShardIndex(userId, count)
  return `shard-${idx + 1}-of-${count}`
}

export function shouldHandleUserOnShard(userId, shardCount, shardIndex) {
  const count = normalizeShardCount(shardCount, 1)
  const idx = Number(shardIndex)
  if (!Number.isFinite(idx) || idx < 0 || idx >= count) return false
  return computeShardIndex(userId, count) === idx
}
