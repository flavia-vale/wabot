// Núcleo PURO de src/core/channelHealth.js — sem import de ../db.js de
// propósito. channelHealth.js importa Prisma (via db.js), e Prisma puxa `fs`;
// um componente client do dashboard que importasse channelHealth.js direto
// quebrava o build do Next ("Module not found: Can't resolve 'fs'"). Mesma
// lição de src/observability/operationalSignals.js: módulo leaf para quem só
// precisa da regra, sem I/O.
//
// channelHealth.js reexporta tudo daqui — não duplicar a lógica lá.

export const HEALTH_STATUS = Object.freeze({
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  CRITICAL: 'critical',
})

export const CONSECUTIVE_FAIL_THRESHOLD = 3
export const PAUSE_DURATION_MS = 60 * 60 * 1000 // 1h

const BLOCKING_HTTP_CODES = new Set(['401', '403'])
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
// respeito.
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
