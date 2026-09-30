// Quando avisar a cliente que o Link Inteligente está enchendo. Puro: sem banco,
// sem relógio implícito, sem envio — só decide e diz qual será o novo estado.
//
// Regras (decisão da dona, 30/09, com a proposta de controle de repetição):
//  - AVISO (`warn`):   TODOS os grupos ativos medidos passaram de 90% da capacidade.
//  - URGENTE (`urgent`): TODOS em 100% (o link mostra "Grupos lotados").
//  - Um aviso ao cruzar; urgente ao lotar (escala mesmo dentro das 24 h).
//  - Enquanto o problema continua: lembrete no máximo 1 vez a cada 24 h e no
//    máximo 2 lembretes por episódio (depois, silêncio: já foi avisada).
//  - Só REARMA (novo episódio) quando algum grupo cai abaixo de 85% ou a cliente
//    adiciona um grupo. Oscilar em torno de 90% não gera novo aviso.
//  - Aviso e lembrete não saem de madrugada (22h–8h de Brasília); o urgente sai
//    a qualquer hora — link lotado perde gente a cada minuto.
//  - Sem medição (nodata) não se conclui nada: nem avisa, nem rearma.

import { REARM_PCT } from './smartLinkOccupancy.js'

export const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000
export const MAX_REMINDERS = 2
export const QUIET_START_HOUR = 22
export const QUIET_END_HOUR = 8

/** Hora cheia (0-23) em Brasília. */
export function hourInSaoPaulo(date) {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(date)
  return Number(hour)
}

export function isQuietHour(date) {
  const h = hourInSaoPaulo(date)
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR
}

export const EMPTY_ALERT_STATE = Object.freeze({ kind: null, lastSentAt: null, reminders: 0, activeGroups: null })

/**
 * @param {object} args
 * @param {{level:string, allFull:boolean, minPct:number|null, activeCount:number}} args.occupancy
 * @param {{kind:'warn'|'urgent'|null, lastSentAt:Date|string|null, reminders:number, activeGroups:number|null}} args.state
 * @param {Date} args.now
 * @returns {{ send: false, rearm: boolean, reason: string } | { send: true, kind: 'warn'|'urgent', reminder: boolean, rearm: boolean }}
 *   `rearm: true` = zerar o estado antes de aplicar (novo episódio).
 */
export function decideAlert({ occupancy, state = EMPTY_ALERT_STATE, now = new Date() }) {
  if (!occupancy || occupancy.level === 'nodata') return { send: false, rearm: false, reason: 'sem_medicao' }

  const open = Boolean(state.kind)

  // 1) Rearme: só com folga real (abaixo de 85%) ou grupo novo no link.
  let rearm = false
  if (open) {
    const droppedBelow = occupancy.level !== 'critical' && occupancy.minPct != null && occupancy.minPct < REARM_PCT
    const groupAdded = Number.isInteger(state.activeGroups) && occupancy.activeCount > state.activeGroups
    rearm = droppedBelow || groupAdded
  }
  const episodeOpen = open && !rearm

  // 2) Gravidade atual.
  const target = occupancy.allFull ? 'urgent' : occupancy.level === 'critical' ? 'warn' : null
  if (!target) return { send: false, rearm, reason: 'abaixo_do_limite' }

  const quiet = isQuietHour(now)

  if (!episodeOpen) {
    if (target === 'warn' && quiet) return { send: false, rearm, reason: 'horario_de_silencio' }
    return { send: true, kind: target, reminder: false, rearm }
  }

  // 3) Episódio aberto: escalada, lembrete ou silêncio.
  if (target === 'urgent' && state.kind === 'warn') return { send: true, kind: 'urgent', reminder: false, rearm: false }

  const last = state.lastSentAt ? new Date(state.lastSentAt).getTime() : NaN
  const due = Number.isFinite(last) && now.getTime() - last >= REMINDER_INTERVAL_MS
  if (due && (state.reminders ?? 0) < MAX_REMINDERS) {
    if (target !== 'urgent' && quiet) return { send: false, rearm: false, reason: 'horario_de_silencio' }
    return { send: true, kind: target, reminder: true, rearm: false }
  }
  return { send: false, rearm: false, reason: due ? 'lembretes_esgotados' : 'ja_avisada' }
}

/** Estado a gravar depois de um envio que deu certo em pelo menos um canal. */
export function stateAfterSend({ decision, state = EMPTY_ALERT_STATE, occupancy, now = new Date() }) {
  const base = decision.rearm ? EMPTY_ALERT_STATE : state
  return {
    kind: decision.kind,
    lastSentAt: now,
    reminders: decision.reminder ? (base.reminders ?? 0) + 1 : 0,
    activeGroups: occupancy.activeCount,
  }
}

/** Estado a gravar quando só houve rearme (sem envio). */
export function stateAfterRearm() {
  return { ...EMPTY_ALERT_STATE }
}
