// Ocupação de um Link Inteligente: o que o painel, o rodízio e os avisos
// enxergam sobre "quão cheio" ele está. Puro (sem banco, sem relógio).
//
// Fonte do número: SEMPRE os membros atuais medidos (última amostra), nunca
// cliques. Amostra velha (> 24 h) não conta como medida: nunca se conclui nada
// "no escuro" (nem alerta, nem "tudo bem").

/** Amostra mais velha que isto (sessão fora do ar, robô removido) não vale como medida. */
export const MEASURABLE_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** A partir daqui o grupo está "quase cheio" (aviso). */
export const WARN_PCT = 90
/** Margem do rodízio: a partir daqui o grupo só recebe tráfego se não houver outro. */
export const ROTATION_MARGIN_PCT = 95
/** A partir daqui o link é medido com mais frequência (antes de chegar na margem). */
export const HOT_PCT = 80
/** O aviso só rearma quando algum grupo cai abaixo disto (histerese contra repique). */
export const REARM_PCT = 85

const pct = (size, cap) => (cap > 0 ? (size / cap) * 100 : 0)

/**
 * @param {Array<{size:number|null, enabled:boolean, hasInvite:boolean, measurable:boolean}>} groups
 * @param {{cap:number, growthPerHour?:number|null}} opts
 *   - `measurable`: amostra recente o bastante para valer como medida.
 *   - `growthPerHour`: membros ganhos por hora no link inteiro (null = sem histórico).
 * @returns {{level:'nodata'|'ok'|'warn'|'critical', avgPct:number|null, minPct:number|null, activeCount:number,
 *   measuredCount:number, above90Count:number, allFull:boolean, remainingSlots:number|null, etaHours:number|null}}
 */
export function summarizeLinkOccupancy(groups, { cap, growthPerHour = null } = {}) {
  // Pausado ou sem convite não é capacidade: o link nunca manda ninguém para lá.
  const active = (groups ?? []).filter(g => g.enabled && g.hasInvite)
  const measured = active.filter(g => g.measurable && Number.isInteger(g.size))

  if (!(cap > 0) || measured.length === 0) {
    return { level: 'nodata', avgPct: null, minPct: null, activeCount: active.length, measuredCount: measured.length, above90Count: 0, allFull: false, remainingSlots: null, etaHours: null }
  }

  const totalSize = measured.reduce((sum, g) => sum + g.size, 0)
  const above90Count = measured.filter(g => pct(g.size, cap) >= WARN_PCT).length
  const allFull = measured.every(g => g.size >= cap)
  // Só diz "crítico" quando TODO grupo ativo foi medido: um grupo sem medida
  // pode ter vaga de sobra, e alarme falso custa a confiança da cliente.
  const everyActiveMeasured = measured.length === active.length
  const level = everyActiveMeasured && above90Count === measured.length
    ? 'critical'
    : above90Count > 0 ? 'warn' : 'ok'

  const remainingSlots = measured.reduce((sum, g) => sum + Math.max(0, cap - g.size), 0)
  const etaHours = growthPerHour > 0 ? Math.round((remainingSlots / growthPerHour) * 10) / 10 : null

  return {
    level,
    avgPct: Math.round(pct(totalSize, cap * measured.length)),
    minPct: Math.round(Math.min(...measured.map(g => pct(g.size, cap)))),
    activeCount: active.length,
    measuredCount: measured.length,
    above90Count,
    allFull,
    remainingSlots,
    etaHours,
  }
}

/**
 * Crescimento do link (membros/hora) a partir das variações por grupo.
 * Usa 7 dias; se algum grupo medido ainda não tem 7 dias de histórico, cai para
 * 24 h; se nem isso, null. Nunca extrapola grupo sem histórico.
 * @param {Array<{delta24h:{diff:number}|null, delta7d:{diff:number}|null}>} measuredGroups
 */
export function linkGrowthPerHour(measuredGroups) {
  if (!measuredGroups?.length) return null
  if (measuredGroups.every(g => g.delta7d)) return measuredGroups.reduce((s, g) => s + g.delta7d.diff, 0) / (7 * 24)
  if (measuredGroups.every(g => g.delta24h)) return measuredGroups.reduce((s, g) => s + g.delta24h.diff, 0) / 24
  return null
}

const LEVEL_RANK = { nodata: 0, ok: 1, warn: 2, critical: 3 }

/** O link "pior" (mais cheio) para o card do painel principal. */
export function pickWorstLink(summaries) {
  return [...(summaries ?? [])].sort((a, b) =>
    (LEVEL_RANK[b.level] - LEVEL_RANK[a.level]) || ((b.avgPct ?? -1) - (a.avgPct ?? -1)))[0] ?? null
}

/**
 * O link está "quente" (merece medição mais frequente) quando algum grupo ativo,
 * com medição recente, já passou de 80% da capacidade.
 * @param {Array<{size:number|null, enabled:boolean, hasInvite:boolean, measurable:boolean}>} groups
 */
export function isHotLink(groups, cap) {
  if (!(cap > 0)) return false
  return (groups ?? []).some(g => g.enabled && g.hasInvite && g.measurable && Number.isInteger(g.size) && pct(g.size, cap) >= HOT_PCT)
}
