// Intervalo entre destinos — ponto ÚNICO do "Intervalo entre destinos"
// (ex-"Atraso entre canais", `BotConfig.channelStaggerJitterMs`, mesma
// coluna, sem migration) e da regra FR-025: quando o intervalo entre destinos
// e o gate do próprio destino se aplicam, vale a MAIOR espera — nunca soma,
// nunca substitui. Spec FR-022 a FR-026, RCA 2026-07-28 (AGENTS.md, "'Atraso
// entre canais' — default 90s → 20s").
//
// Módulo PURO: sem banco, sem rede, sem relógio próprio (`now` sempre por
// parâmetro), sem env lida no topo (env sempre por parâmetro).
//
// Consumidores permitidos (guarda estrutural em
// test/destination-spacing-chokepoint.test.js):
//   - src/bot-worker.js → processSendJob (decide, combina, adia, atualiza estado)
//   - src/core/channelThrottle.js → checkAndReserve (só reserva se combinado libera)
//   - scripts/diag-antiban-valores.mjs → projeção de atraso/vazão (import, nunca cópia)

export const DESTINATION_SPACING_REASON = 'destination_spacing'

const MAX_INTERVAL_MS = 600_000

/**
 * false somente se env.DESTINATION_SPACING === 'off' (exato, case-sensitive).
 * @param {object} [env] default process.env
 */
export function isDestinationSpacingEnabled(env = process.env) {
  return env?.DESTINATION_SPACING !== 'off'
}

/**
 * Lê channelStaggerJitterMs do botConfig. Inteiro >= 0, teto 600000ms.
 * Inválido/ausente/negativo vira 0 (0 = sem espaçamento extra). NÃO aplica o
 * "padrão de 20s" sozinho — o padrão vem do banco (BotConfig).
 * @param {object|null} botConfig
 */
export function toDestinationIntervalMs(botConfig) {
  const raw = Number(botConfig?.channelStaggerJitterMs)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(Math.floor(raw), MAX_INTERVAL_MS)
}

/**
 * Decide se o envio para `destJid` pode sair agora, ou se precisa esperar o
 * intervalo entre destinos desde o ÚLTIMO envio da conta (qualquer destino).
 *
 * allow quando: espaçamento desligado, intervalo <= 0, primeiro envio do
 * worker (lastSendAt null), ou destJid === lastDestJid SEM fila de outros
 * destinos esperando (mesmo destino é isento — quem decide a cadência dentro
 * do mesmo destino é o próprio minIntervalSec dele).
 *
 * Senha de vez (`ticket`, RCA 2026-10-01 "só um grupo recebe"): o job adiado
 * guarda a vaga que recebeu (`deferUntil`) e a devolve aqui quando volta. Quem
 * tem senha sai quando a vaga chega (respeitando o intervalo desde o último
 * envio), sem ser jogado de novo para o fim da fila. Antes não havia senha:
 * o job voltava, encontrava `nextFreeSlotAt` já empurrado pelos jobs adiados
 * DEPOIS dele e era adiado de novo, para sempre — enquanto o destino do último
 * envio, isento, furava a fila. Resultado: um grupo recebia tudo e os outros
 * nada.
 *
 * Sem senha: earliest = max(lastSendAt + intervalMs, nextFreeSlotAt) e a
 * decisão adiada devolve `ticket = deferUntil` (a vaga reservada).
 *
 * @param {{ now:number, destJid:string, intervalMs:number,
 *   state:{lastSendAt:number|null,lastDestJid:string|null,nextFreeSlotAt:number|null},
 *   enabled?:boolean, ticket?:number|null }} input
 * @returns {{ allow:boolean, deferUntil?:number, ticket?:number, reason?:'destination_spacing' }}
 */
export function decideDestinationSpacing({ now, destJid, intervalMs, state, enabled = true, ticket = null }) {
  if (!enabled) return { allow: true }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return { allow: true }
  if (state?.lastSendAt == null) return { allow: true }

  const sameDest = destJid === state?.lastDestJid
  const minGapAt = state.lastSendAt + intervalMs
  const ticketAt = Number.isFinite(Number(ticket)) && ticket != null ? Number(ticket) : null

  if (ticketAt != null) {
    if (now >= ticketAt && sameDest) return { allow: true }
    const earliest = Math.max(ticketAt, minGapAt)
    if (now >= earliest) return { allow: true }
    return { allow: false, deferUntil: earliest, ticket: ticketAt, reason: DESTINATION_SPACING_REASON }
  }

  const nextFree = state.nextFreeSlotAt ?? 0
  const othersWaiting = now < nextFree
  if (sameDest && !othersWaiting) return { allow: true }

  const earliest = Math.max(minGapAt, nextFree)
  if (now >= earliest) return { allow: true }
  return { allow: false, deferUntil: earliest, ticket: earliest, reason: DESTINATION_SPACING_REASON }
}

/**
 * Combina a decisão do gate do PRÓPRIO destino (decideDestination, "peek" sem
 * reservar) com a decisão de espaçamento entre destinos (FR-025: vale a MAIOR
 * espera, nunca soma, nunca substitui). allow só quando as duas liberam.
 *
 * @param {{allow:boolean, deferUntil?:number, reason?:string}} destDecision
 * @param {{allow:boolean, deferUntil?:number, reason?:string}} spacingDecision
 * @returns {{allow:boolean, deferUntil?:number, reason?:string, source:'destination'|'spacing'|'both'|null}}
 */
export function combineGateDecisions(destDecision, spacingDecision) {
  const destAllow = destDecision?.allow !== false
  const spacingAllow = spacingDecision?.allow !== false
  if (destAllow && spacingAllow) return { allow: true, source: null }

  const destDefer = destAllow ? -Infinity : (destDecision?.deferUntil ?? -Infinity)
  const spacingDefer = spacingAllow ? -Infinity : (spacingDecision?.deferUntil ?? -Infinity)

  if (!destAllow && !spacingAllow) {
    if (destDefer === spacingDefer) {
      return { allow: false, deferUntil: destDefer, reason: destDecision.reason, source: 'both' }
    }
    if (destDefer > spacingDefer) {
      return { allow: false, deferUntil: destDefer, reason: destDecision.reason, source: 'destination' }
    }
    return { allow: false, deferUntil: spacingDefer, reason: spacingDecision.reason, source: 'spacing' }
  }
  if (!destAllow) {
    return { allow: false, deferUntil: destDecision.deferUntil, reason: destDecision.reason, source: 'destination' }
  }
  return { allow: false, deferUntil: spacingDecision.deferUntil, reason: spacingDecision.reason, source: 'spacing' }
}

/**
 * Atualiza o estado de espaçamento (em memória do worker) no MESMO instante
 * em que o gate combinado decide. Devolve um objeto NOVO (nunca muta a
 * entrada).
 *
 * - Envio liberado (deferredUntil null/ausente): lastSendAt=now,
 *   lastDestJid=destJid — este é o novo "último envio da conta".
 * - Job adiado pelo espaçamento: nextFreeSlotAt = deferredUntil + intervalMs
 *   — é o cursor que dá a vaga ao PRÓXIMO job simultâneo sem recalcular
 *   contra o lastSendAt antigo (evita cascata O(N²)). O cursor só ANDA para
 *   frente: um job com senha re-adiado para antes do cursor não o puxa de
 *   volta (senão a vaga de quem está mais atrás seria dada de novo).
 *
 * @param {{lastSendAt:number|null,lastDestJid:string|null,nextFreeSlotAt:number|null}} state
 * @param {{now:number, destJid:string, intervalMs:number, deferredUntil?:number|null}} opts
 */
export function reserveSpacingSlot(state, { now, destJid, intervalMs, deferredUntil = null }) {
  if (deferredUntil == null) {
    return { ...state, lastSendAt: now, lastDestJid: destJid }
  }
  return { ...state, nextFreeSlotAt: Math.max(state?.nextFreeSlotAt ?? 0, deferredUntil + intervalMs) }
}
