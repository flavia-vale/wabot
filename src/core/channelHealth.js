// PR-5.C.1: detecção precoce de degradação de canais-destino.
// Núcleo puro (`nextStateOnSuccess`, `nextStateOnFailure`, `isChannelPaused`)
// + wrappers de I/O com Prisma injetável via opts.db (para testes).

import defaultDb from '../db.js'

export const HEALTH_STATUS = Object.freeze({
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  CRITICAL: 'critical',
})

export const CONSECUTIVE_FAIL_THRESHOLD = 3
export const PAUSE_DURATION_MS = 60 * 60 * 1000 // 1h

const BLOCKING_HTTP_CODES = new Set(['401', '403'])
const STREAM_CRITICAL_CODES = new Set(['forbidden', 'not-authorized', '401', '403'])
const STREAM_YELLOW_CODES = new Set(['rate-overlimit', '429'])

export function nextStateOnSuccess({ currentStatus, consecutiveFailures, pausedUntil = null }) {
  return {
    status: currentStatus === HEALTH_STATUS.CRITICAL ? HEALTH_STATUS.CRITICAL : HEALTH_STATUS.GREEN,
    consecutiveFailures: 0,
    pausedUntil,
  }
}

export function nextStateOnFailure({ currentStatus, consecutiveFailures, errorCode, now }) {
  const nextFailures = consecutiveFailures + 1
  const code = errorCode == null ? '' : String(errorCode)
  const isBlocking = BLOCKING_HTTP_CODES.has(code)
  if (isBlocking && nextFailures >= CONSECUTIVE_FAIL_THRESHOLD) {
    return {
      status: HEALTH_STATUS.RED,
      consecutiveFailures: nextFailures,
      pausedUntil: now + PAUSE_DURATION_MS,
    }
  }
  return {
    status: currentStatus,
    consecutiveFailures: nextFailures,
    pausedUntil: null,
  }
}

export function isChannelPaused(health, now = Date.now()) {
  if (!health?.pausedUntil) return false
  const ms = health.pausedUntil instanceof Date
    ? health.pausedUntil.getTime()
    : new Date(health.pausedUntil).getTime()
  return ms > now
}

// Traduz status+lastError+contadores em algo que a cliente possa AGIR — só o
// status ("verde"/"amarelo") não diz o que fez o canal cair nem o que fazer a
// respeito. Pura, sem I/O, para caber tanto no backend quanto (via import
// direto, mesmo padrão de canUseAdvancedPreservation) na tela do painel.
export function describeChannelHealthStatus(health, now = Date.now()) {
  const status = health?.status ?? HEALTH_STATUS.GREEN
  const lastError = health?.lastError ?? null
  const consecutiveFailures = health?.consecutiveFailures ?? 0
  const paused = isChannelPaused(health, now)
  const isBlockingError = lastError != null && BLOCKING_HTTP_CODES.has(String(lastError).replace(/^stream:/, ''))
  const isRateError = lastError != null && STREAM_YELLOW_CODES.has(String(lastError).replace(/^stream:/, ''))

  if (status === HEALTH_STATUS.CRITICAL) {
    return {
      emoji: '🟠',
      label: 'Crítico',
      motivo: 'O WhatsApp bloqueou o robô neste canal (sem permissão para postar).',
      oQueFazer: 'Confira se o robô ainda é admin do canal, ou reconecte o WhatsApp.',
    }
  }
  if (status === HEALTH_STATUS.RED || paused) {
    return {
      emoji: '🔴',
      label: 'Pausado',
      motivo: isBlockingError
        ? `Perdeu a permissão de postar (código ${lastError}).`
        : `Pausado depois de ${consecutiveFailures} falhas seguidas ao enviar.`,
      oQueFazer: health?.pausedUntil
        ? `Confira se o robô continua admin do canal. Ele tenta de novo sozinho às ${new Date(health.pausedUntil).toLocaleString('pt-BR')}.`
        : 'Confira se o robô continua sendo admin do canal.',
    }
  }
  if (status === HEALTH_STATUS.YELLOW) {
    return {
      emoji: '🟡',
      label: 'Atenção',
      motivo: isRateError
        ? 'O WhatsApp pediu para esperar (limite de envio atingido).'
        : `Teve ${consecutiveFailures || 'algumas'} falha(s) recente(s) ao enviar.`,
      oQueFazer: 'O robô já está enviando mais devagar sozinho. Se continuar amanhã, confira a permissão do robô no canal.',
    }
  }
  if (status === HEALTH_STATUS.GREEN && health && (health.lastPostedAt || health.lastProbeSeenAt)) {
    return {
      emoji: '🟢',
      label: 'Saudável',
      motivo: 'Está enviando normalmente.',
      oQueFazer: 'Nada a fazer.',
    }
  }
  return {
    emoji: '⚫',
    label: 'Sem dados',
    motivo: 'Ainda não houve envio para este canal para medir.',
    oQueFazer: 'Nada a fazer — aguarde a primeira oferta ser enviada.',
  }
}

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
