// PR-5.C.1: detecção precoce de degradação de canais-destino.
// Núcleo puro (`nextStateOnSuccess`, `nextStateOnFailure`, `isChannelPaused`,
// `describeChannelHealthStatus`) mora em ./channelHealthStatus.js (módulo
// leaf, sem import de db.js) — reexportado aqui. Não duplicar a lógica: quem
// só precisa da regra pura (ex.: um componente client do dashboard) importa
// direto de channelHealthStatus.js, para não puxar Prisma/`fs` no bundle.
// Este arquivo soma os wrappers de I/O com Prisma injetável via opts.db.

import defaultDb from '../db.js'
import {
  HEALTH_STATUS,
  CONSECUTIVE_FAIL_THRESHOLD,
  PAUSE_DURATION_MS,
  nextStateOnSuccess,
  nextStateOnFailure,
  isChannelPaused,
  describeChannelHealthStatus,
} from './channelHealthStatus.js'

export {
  HEALTH_STATUS,
  CONSECUTIVE_FAIL_THRESHOLD,
  PAUSE_DURATION_MS,
  nextStateOnSuccess,
  nextStateOnFailure,
  isChannelPaused,
  describeChannelHealthStatus,
}

const STREAM_CRITICAL_CODES = new Set(['forbidden', 'not-authorized', '401', '403'])
const STREAM_YELLOW_CODES = new Set(['rate-overlimit', '429'])

export async function getHealth(groupId, opts = {}) {
  const db = opts.db ?? defaultDb
  const row = await db.channelHealth.findUnique({ where: { groupId } })
  if (!row) {
    return {
      groupId,
      status: HEALTH_STATUS.GREEN,
      consecutiveFailures: 0,
      lastError: null,
      pausedUntil: null,
      lastPostedAt: null,
      lastProbeSeenAt: null,
    }
  }
  return row
}

/**
 * @param {string} groupId
 * @param {{ ok: boolean, latencyMs?: number, errorCode?: string|number, errorMsg?: string }} result
 * @param {{ db?: any, now?: number }} [opts]
 */
export async function recordSendResult(groupId, result, opts = {}) {
  const db = opts.db ?? defaultDb
  const now = opts.now ?? Date.now()
  const current = await getHealth(groupId, { db })

  if (result.ok) {
    const next = nextStateOnSuccess({
      currentStatus: current.status,
      consecutiveFailures: current.consecutiveFailures,
      pausedUntil: isChannelPaused(current, now) ? current.pausedUntil : null,
    })
    return db.channelHealth.upsert({
      where: { groupId },
      create: {
        groupId,
        status: next.status,
        consecutiveFailures: 0,
        lastPostedAt: new Date(now),
        latencyP95_1h: result.latencyMs ?? null,
      },
      update: {
        status: next.status,
        consecutiveFailures: 0,
        lastError: null,
        lastPostedAt: new Date(now),
      },
    })
  }

  const next = nextStateOnFailure({
    currentStatus: current.status,
    consecutiveFailures: current.consecutiveFailures,
    errorCode: result.errorCode,
    now,
  })
  return db.channelHealth.upsert({
    where: { groupId },
    create: {
      groupId,
      status: next.status,
      consecutiveFailures: next.consecutiveFailures,
      lastError: result.errorMsg ?? (result.errorCode != null ? String(result.errorCode) : null),
      pausedUntil: next.pausedUntil ? new Date(next.pausedUntil) : null,
    },
    update: {
      status: next.status,
      consecutiveFailures: next.consecutiveFailures,
      lastError: result.errorMsg ?? (result.errorCode != null ? String(result.errorCode) : null),
      pausedUntil: next.pausedUntil ? new Date(next.pausedUntil) : current.pausedUntil ?? null,
    },
  })
}

/**
 * Stream errors da sessão afetam todos os canais-destino do user em bloco.
 * @param {string} userId
 * @param {string} code
 * @param {{ db?: any }} [opts]
 */
export async function recordStreamError(userId, code, opts = {}) {
  const db = opts.db ?? defaultDb
  const codeStr = String(code ?? '')
  let nextStatus = null
  if (STREAM_CRITICAL_CODES.has(codeStr)) nextStatus = HEALTH_STATUS.CRITICAL
  else if (STREAM_YELLOW_CODES.has(codeStr)) nextStatus = HEALTH_STATUS.YELLOW
  if (!nextStatus) return { count: 0 }

  const groups = await db.group.findMany({
    where: { userId, kind: 'channel', role: 'post' },
    select: { id: true },
  })
  if (!groups.length) return { count: 0 }
  const ids = groups.map(g => g.id)

  return db.channelHealth.updateMany({
    where: { groupId: { in: ids }, group: { userId } },
    data: { status: nextStatus, lastError: `stream:${codeStr}` },
  })
}

export async function recomputeHealth(_groupId, _opts = {}) {
  // Stub: errorRate1h / latencyP95 derivados de MessageLog ficam para o
  // worker periódico. Por ora a transição é event-driven via recordSendResult.
  return null
}
