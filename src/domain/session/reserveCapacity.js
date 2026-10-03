// Vaga para o número reserva (docs/rca/multi-numero.md). Cada reserva ocupa
// uma vaga igual a um robô. O número principal de qualquer conta tem
// prioridade: a reserva só liga se, depois dela, ainda sobrarem
// `headroom` vagas livres para principais. Sem dado de contagem/teto = recusa
// (fail-closed: reserva é extra, nunca pode tirar vaga de quem já paga).
export const DEFAULT_RESERVE_HEADROOM = 5

export function reserveHeadroom(env = process.env) {
  const n = Number(env?.MULTI_NUMBER_RESERVE_HEADROOM)
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_RESERVE_HEADROOM
}

export function canStartReserve({ runningCount, maxSessions, headroom = DEFAULT_RESERVE_HEADROOM } = {}) {
  if (!Number.isFinite(runningCount) || !Number.isFinite(maxSessions)) return { ok: false, reason: 'capacity_unknown' }
  if (runningCount + 1 > maxSessions - headroom) return { ok: false, reason: 'capacity_reserved_for_primary' }
  return { ok: true, reason: null }
}
