import { resolveRedisUrl, EVENTS_CHANNEL, encodeEvent } from '../supervisor/protocol.js'
import { buildRedisOptions } from './redisFactory.js'
import logger from '../logger.js'

const PROBE_SESSION_STATES = new Set(['disconnected', 'connecting', 'qr_pending', 'connected', 'error'])
const SESSION_TTL_SECONDS = 10 * 60

let redisPub = null
let redisGet = null

async function getRedisClients() {
  const redisUrl = resolveRedisUrl()
  if (!redisUrl) return null
  if (redisPub && redisGet) return { redisPub, redisGet }
  const mod = await import('ioredis')
  const Redis = mod.default ?? mod.Redis ?? mod
  // maxRetriesPerRequest:1 = fail-fast quando o Redis pisca. Conexões de comando
  // (hset/hgetall/publish), não subscriber — sem isso, com Redis fora do ar os
  // comandos ficavam presos no retry default do ioredis (20×) e empilhavam
  // latência nas rotas de probe. Alinha ao padrão dos demais clients "planos".
  redisPub = redisPub ?? new Redis(redisUrl, buildRedisOptions('probe-pub', { lazyConnect: false, maxRetriesPerRequest: 1 }))
  redisGet = redisGet ?? new Redis(redisUrl, buildRedisOptions('probe-get', { lazyConnect: false, maxRetriesPerRequest: 1 }))
  redisPub.on('error', err => logger.warn({ err: err?.message }, 'probeSessions redisPub error'))
  redisGet.on('error', err => logger.warn({ err: err?.message }, 'probeSessions redisGet error'))
  return { redisPub, redisGet }
}

function sanitizeState(state) {
  return PROBE_SESSION_STATES.has(state) ? state : 'error'
}

function keyFor(userId) {
  return `probe:session:${userId}`
}

function parseHash(hash = {}) {
  if (!hash || !hash.state) return null
  return {
    sessionId: hash.sessionId || null,
    state: sanitizeState(hash.state),
    qrExpiresAt: hash.qrExpiresAt ? new Date(hash.qrExpiresAt) : null,
    updatedAt: hash.updatedAt ? new Date(hash.updatedAt) : null,
    lastError: hash.lastError || null,
  }
}

export async function getProbeSessionSnapshot(userId) {
  const clients = await getRedisClients()
  if (!clients) return { sessionId: null, state: 'disconnected', qrExpiresAt: null, updatedAt: null, lastError: 'redis_unavailable' }
  const hash = await clients.redisGet.hgetall(keyFor(userId))
  const parsed = parseHash(hash)
  return parsed ?? { sessionId: null, state: 'disconnected', qrExpiresAt: null, updatedAt: null, lastError: null }
}

export async function setProbeSession(userId, patch = {}) {
  const clients = await getRedisClients()
  if (!clients) throw new Error('Redis indisponível para sessão probe')
  const prev = await getProbeSessionSnapshot(userId)
  const updatedAt = new Date()
  const next = {
    sessionId: patch.sessionId ?? prev.sessionId,
    state: sanitizeState(patch.state ?? prev.state),
    qrExpiresAt: patch.qrExpiresAt ?? prev.qrExpiresAt,
    updatedAt,
    lastError: patch.lastError ?? prev.lastError,
  }

  await clients.redisPub.hset(keyFor(userId), {
    sessionId: next.sessionId || '',
    state: next.state,
    qrExpiresAt: next.qrExpiresAt ? new Date(next.qrExpiresAt).toISOString() : '',
    updatedAt: updatedAt.toISOString(),
    lastError: next.lastError || '',
  })
  await clients.redisPub.expire(keyFor(userId), SESSION_TTL_SECONDS)
  await publishProbeSessionEvent(userId, next)
  return next
}

export async function isProbeSessionSelectable(userId, probeAccountSessionId) {
  const row = await getProbeSessionSnapshot(userId)
  return row.sessionId === probeAccountSessionId && (row.state === 'connected' || row.state === 'qr_pending' || row.state === 'connecting')
}

export async function publishProbeSessionEvent(userId, session) {
  const clients = await getRedisClients()
  if (!clients) return
  await clients.redisPub.publish(EVENTS_CHANNEL, encodeEvent({
    userId,
    type: 'probe_session_status',
    data: {
      state: session.state,
      sessionId: session.sessionId ?? null,
      qrExpiresAt: session.qrExpiresAt ? new Date(session.qrExpiresAt).toISOString() : null,
      updatedAt: session.updatedAt ? new Date(session.updatedAt).toISOString() : null,
      lastError: session.lastError ?? null,
    },
  }))
}
