// Regras puras do painel "Membros": variação por janela e retenção das amostras.
// Amostras = { size, sampledAt }, uma por grupo por hora (job horário).

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const MEMBER_SAMPLE_HOURLY_DAYS = 7
export const MEMBER_SAMPLE_MAX_DAYS = 90
// Amostra mais velha que isto não é "atual": o painel mostra "sem dado recente".
export const MEMBER_SAMPLE_STALE_HOURS = 3

const ts = (v) => (v instanceof Date ? v : new Date(v)).getTime()

/**
 * Variação entre a última medição e a amostra mais próxima de `windowDays`
 * ANTES dela. Ancorar na última medição (não em "agora") evita comparar um
 * dado velho com uma janela que ele nunca cobriu quando a sessão ficou fora do
 * ar. Escolher a mais próxima do alvo (e não "a mais nova que passa do corte")
 * mantém a janela em 24 h de verdade com amostras horárias.
 * Sem amostra dentro da tolerância (grupo novo no painel) devolve null — nunca
 * inventa variação a partir de um histórico curto demais.
 */
export function computeDelta(samples, windowDays) {
  if (!Array.isArray(samples) || samples.length < 2) return null
  const sorted = [...samples].sort((a, b) => ts(b.sampledAt) - ts(a.sampledAt))
  const latest = sorted[0]
  const target = ts(latest.sampledAt) - windowDays * DAY_MS
  // Depois de 7 dias o histórico é 1 amostra/dia (ver pruneMemberSampleIds):
  // janelas longas aceitam até 12 h de distância; a de 24 h, só 3 h.
  const tolerance = (windowDays <= 1 ? 3 : 12) * HOUR_MS
  let base = null
  let bestGap = Infinity
  for (const s of sorted.slice(1)) {
    const gap = Math.abs(ts(s.sampledAt) - target)
    if (gap < bestGap) { bestGap = gap; base = s }
  }
  if (!base || bestGap > tolerance) return null
  const diff = latest.size - base.size
  return { diff, pct: base.size > 0 ? Math.round((diff / base.size) * 1000) / 10 : null }
}

export function summarizeGroupMembers(samples, now = new Date()) {
  const sorted = [...(samples ?? [])].sort((a, b) => ts(b.sampledAt) - ts(a.sampledAt))
  const latest = sorted[0] ?? null
  const ageHours = latest ? (ts(now) - ts(latest.sampledAt)) / HOUR_MS : null
  return {
    size: latest?.size ?? null,
    sampledAt: latest ? new Date(ts(latest.sampledAt)).toISOString() : null,
    stale: latest ? ageHours > MEMBER_SAMPLE_STALE_HOURS : true,
    delta24h: computeDelta(sorted, 1),
    delta7d: computeDelta(sorted, 7),
    delta30d: computeDelta(sorted, 30),
  }
}

/**
 * IDs a apagar: passou de 90 dias, ou tem mais de 7 dias e não é a última
 * amostra do seu dia (UTC). Mantém o banco pequeno sem perder a curva.
 */
export function pruneMemberSampleIds(samples, now = new Date()) {
  const hourlyCutoff = ts(now) - MEMBER_SAMPLE_HOURLY_DAYS * DAY_MS
  const maxCutoff = ts(now) - MEMBER_SAMPLE_MAX_DAYS * DAY_MS
  const lastOfDay = new Map()
  for (const s of samples ?? []) {
    const day = new Date(ts(s.sampledAt)).toISOString().slice(0, 10)
    const cur = lastOfDay.get(day)
    if (!cur || ts(s.sampledAt) > ts(cur.sampledAt)) lastOfDay.set(day, s)
  }
  return (samples ?? []).filter(s => {
    const t = ts(s.sampledAt)
    if (t < maxCutoff) return true
    if (t >= hourlyCutoff) return false
    const day = new Date(t).toISOString().slice(0, 10)
    return lastOfDay.get(day)?.id !== s.id
  }).map(s => s.id)
}
