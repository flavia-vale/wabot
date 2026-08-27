const DAY_MS = 86_400_000
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const iso = (value) => value == null ? null : new Date(value).toISOString()

function latestStableSegment(samples) {
  const ordered = [...samples].filter((sample) => sample?.collectedAt).sort((a, b) => new Date(a.collectedAt) - new Date(b.collectedAt))
  if (!ordered.length) return []
  const last = ordered.at(-1)
  let start = ordered.length - 1
  while (start > 0) {
    const previous = ordered[start - 1]
    if ((previous.hostProfileId ?? null) !== (last.hostProfileId ?? null) || (previous.policyVersion ?? null) !== (last.policyVersion ?? null)) break
    start -= 1
  }
  return ordered.slice(start)
}

function regression(points) {
  const origin = new Date(points[0].collectedAt).getTime()
  const pairs = points.map((point) => ({ x: (new Date(point.collectedAt).getTime() - origin) / DAY_MS, y: finite(point.connectedSessions ?? point.productionWorkers) })).filter(({ y }) => y != null)
  if (pairs.length < 2) return null
  const xMean = pairs.reduce((sum, p) => sum + p.x, 0) / pairs.length
  const yMean = pairs.reduce((sum, p) => sum + p.y, 0) / pairs.length
  const denominator = pairs.reduce((sum, p) => sum + (p.x - xMean) ** 2, 0)
  if (!denominator) return null
  const slope = pairs.reduce((sum, p) => sum + (p.x - xMean) * (p.y - yMean), 0) / denominator
  const intercept = yMean - slope * xMean
  const residuals = pairs.map((p) => p.y - (intercept + slope * p.x))
  const residualStdDev = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, residuals.length - 2))
  return { slope, intercept, residualStdDev, origin, pairs }
}

function growthForWindow(segment, newestAt, days) {
  const cutoff = newestAt.getTime() - days * DAY_MS
  const rows = segment.filter((sample) => new Date(sample.collectedAt).getTime() >= cutoff && finite(sample.connectedSessions ?? sample.productionWorkers) != null)
  if (rows.length < 2) return { days, net: null, perDay: null, sampleCount: rows.length, coverageDays: 0 }
  const first = rows[0]; const last = rows.at(-1)
  const covered = Math.max(0, (new Date(last.collectedAt) - new Date(first.collectedAt)) / DAY_MS)
  const net = finite(last.connectedSessions ?? last.productionWorkers) - finite(first.connectedSessions ?? first.productionWorkers)
  return { days, net, perDay: covered > 0 ? net / covered : null, sampleCount: rows.length, coverageDays: covered }
}

export function forecastCapacity(samples = [], { now = new Date() } = {}) {
  const segment = latestStableSegment(samples)
  const newestAt = segment.at(-1)?.collectedAt ? new Date(segment.at(-1).collectedAt) : null
  const coverageDays = segment.length > 1 ? (newestAt - new Date(segment[0].collectedAt)) / DAY_MS : 0
  const growth = newestAt ? Object.fromEntries([7, 30, 90].map((days) => [days, growthForWindow(segment, newestAt, days)])) : {}
  const unavailable = (reason) => ({ windowDays: null, centralThresholdAt: null, range: null, confidence: 'insufficient', reasonUnavailable: reason, explanation: reason === 'minimum_history' ? 'São necessários ao menos 7 dias de histórico estável.' : reason === 'limit_reached' ? 'O limite seguro já foi atingido; a projeção de data não se aplica.' : reason === 'missing_safe_limit' ? 'O limite seguro não está disponível para projetar uma data.' : 'O crescimento não é positivo; não há data de limite projetada.', growth, coverage: { days: coverageDays, sampleCount: segment.length }, segment: { hostProfileId: segment.at(-1)?.hostProfileId ?? null, policyVersion: segment.at(-1)?.policyVersion ?? null } })
  if (coverageDays < 7) return unavailable('minimum_history')
  const availableWindows = [90, 30, 7].filter((days) => coverageDays >= days - 1)
  const windowDays = availableWindows.includes(30) ? 30 : availableWindows[0] ?? 7
  const cutoff = newestAt.getTime() - windowDays * DAY_MS
  const window = segment.filter((sample) => new Date(sample.collectedAt).getTime() >= cutoff)
  const fit = regression(window)
  if (!fit || fit.slope <= 0) return unavailable('non_positive_growth')
  const last = window.at(-1)
  const current = finite(last.connectedSessions ?? last.productionWorkers)
  const limit = finite(last.safeSessionLimit)
  if (current == null || limit == null || limit <= current) return unavailable(limit == null ? 'missing_safe_limit' : 'limit_reached')
  const daysToLimit = (limit - current) / fit.slope
  const uncertaintyDays = Math.max(1, (fit.residualStdDev * 1.96) / fit.slope)
  const central = new Date(Math.max(now.getTime(), newestAt.getTime()) + daysToLimit * DAY_MS)
  const confidence = coverageDays >= 60 && fit.residualStdDev <= 1 ? 'high' : coverageDays >= 14 ? 'medium' : 'low'
  return { windowDays, centralThresholdAt: iso(central), range: { earliestAt: iso(new Date(central.getTime() - uncertaintyDays * DAY_MS)), latestAt: iso(new Date(central.getTime() + uncertaintyDays * DAY_MS)) }, confidence, reasonUnavailable: null, growthPerDay: fit.slope, growth, explanation: `Projeção baseada na tendência dos últimos ${windowDays} dias, sem misturar mudanças de host ou política.`, coverage: { days: coverageDays, sampleCount: segment.length }, segment: { hostProfileId: last.hostProfileId ?? null, policyVersion: last.policyVersion ?? null } }
}
