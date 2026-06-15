import { trackAnalyticsEventSafe } from '../analytics.js'

// Quotas por tenant — sem elas, um único cliente (ou integração com bug em
// loop) pode criar recursos sem teto e gerar carga descontrolada sobre o
// SQLite/host compartilhados por todos. Limites conservadores, ajustáveis por
// env e por plano no futuro.

export const QUOTAS = {
  groupsPerUser: Math.max(1, Number(process.env.MAX_GROUPS_PER_USER || 50)),
  automationsPerUser: Math.max(1, Number(process.env.MAX_AUTOMATIONS_PER_USER || 10)),
  offerQueuesPerUser: Math.max(1, Number(process.env.MAX_OFFER_QUEUES_PER_USER || 5)),
  pendingItemsPerQueue: Math.max(1, Number(process.env.MAX_PENDING_ITEMS_PER_QUEUE || 500)),
  pendingScheduledPerUser: Math.max(1, Number(process.env.MAX_PENDING_SCHEDULED_PER_USER || 500)),
  broadcastsPerMinute: Math.max(1, Number(process.env.MAX_BROADCASTS_PER_MINUTE || 10)),
  broadcastsPerHour: Math.max(1, Number(process.env.MAX_BROADCASTS_PER_HOUR || 100)),
}

function quotaError(reply, { userId, quota, limit, current, message }) {
  trackAnalyticsEventSafe({ userId, event: 'quota_exceeded', metadata: { quota, limit, current } })
  return reply.code(400).send({ error: message, quota, limit })
}

// Caps de contagem de recursos (grupos, automações, filas, pendências).
// Devolve true quando dentro do limite; caso contrário responde 400 e
// devolve false (padrão das demais validações de rota deste repo).
export async function ensureCountQuota(reply, { userId, quota, count, label }) {
  const limit = QUOTAS[quota]
  const current = await count()
  if (current < limit) return true
  quotaError(reply, {
    userId,
    quota,
    limit,
    current,
    message: `Limite atingido: máximo de ${limit} ${label}. Remova/conclua itens existentes antes de criar novos.`,
  })
  return false
}

// Rate limit de broadcasts por tenant (janela deslizante in-memory; cobre a
// instância única atual — ao escalar para múltiplas APIs, mover para Redis).
const broadcastHistory = new Map() // userId -> timestamps (ms)
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

export function checkBroadcastRate(userId, now = Date.now()) {
  const cutoff = now - HOUR_MS
  const entries = (broadcastHistory.get(userId) ?? []).filter((t) => t > cutoff)
  const lastMinute = entries.filter((t) => t > now - MINUTE_MS).length
  if (lastMinute >= QUOTAS.broadcastsPerMinute) {
    const retryAfterSec = Math.ceil((entries[entries.length - QUOTAS.broadcastsPerMinute] + MINUTE_MS - now) / 1000)
    broadcastHistory.set(userId, entries)
    return { allowed: false, scope: 'minute', limit: QUOTAS.broadcastsPerMinute, retryAfterSec: Math.max(1, retryAfterSec) }
  }
  if (entries.length >= QUOTAS.broadcastsPerHour) {
    const retryAfterSec = Math.ceil((entries[0] + HOUR_MS - now) / 1000)
    broadcastHistory.set(userId, entries)
    return { allowed: false, scope: 'hour', limit: QUOTAS.broadcastsPerHour, retryAfterSec: Math.max(1, retryAfterSec) }
  }
  entries.push(now)
  broadcastHistory.set(userId, entries)
  return { allowed: true }
}

export function ensureBroadcastRate(reply, userId, now = Date.now()) {
  const verdict = checkBroadcastRate(userId, now)
  if (verdict.allowed) return true
  trackAnalyticsEventSafe({ userId, event: 'quota_exceeded', metadata: { quota: `broadcastsPer${verdict.scope === 'minute' ? 'Minute' : 'Hour'}`, limit: verdict.limit } })
  reply
    .code(429)
    .header('retry-after', String(verdict.retryAfterSec))
    .send({ error: `Limite de envios por ${verdict.scope === 'minute' ? 'minuto' : 'hora'} atingido (${verdict.limit}). Tente novamente em ${verdict.retryAfterSec}s.` })
  return false
}

// Cleanup periódico do histórico (mesmo padrão do rate limit de login).
export function startBroadcastRateCleanup(intervalMs = 10 * MINUTE_MS) {
  const timer = setInterval(() => {
    const cutoff = Date.now() - HOUR_MS
    for (const [userId, entries] of broadcastHistory) {
      const fresh = entries.filter((t) => t > cutoff)
      if (fresh.length) broadcastHistory.set(userId, fresh)
      else broadcastHistory.delete(userId)
    }
  }, intervalMs)
  timer.unref?.()
  return timer
}

// Exposto para testes
export function _resetBroadcastHistory() {
  broadcastHistory.clear()
}

// Top-level + unref, mesmo padrão do startLoginAttemptsCleanup de auth.js.
startBroadcastRateCleanup()
