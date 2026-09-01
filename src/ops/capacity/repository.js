import { sanitizeCapacityValue } from './contract.js'

export const CAPACITY_BASELINE_HOST_KEY = 'hetzner:128727108'
export const CAPACITY_BASELINE = Object.freeze({ hostKey: CAPACITY_BASELINE_HOST_KEY, hostname: 'wabot-prod', provider: 'hetzner', providerServerId: '128727108', serverType: 'CX33', architecture: 'x86', vcpu: 4, memoryTotalMb: 8192, diskTotalMb: 40960, region: 'eu-central', inventoryJson: '{}', source: 'baseline' })
const json = (value, fallback) => JSON.stringify(sanitizeCapacityValue(value) ?? fallback)
const floorBucket = (date, granularity) => { const d = new Date(date); granularity === 'day' ? d.setUTCHours(0, 0, 0, 0) : d.setUTCMinutes(0, 0, 0); return d }
const finite = (values) => values.filter(Number.isFinite)
const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
const worst = (states) => ['insufficient_data', 'healthy', 'attention', 'plan_now', 'critical'].reduce((result, state) => states.includes(state) ? state : result, 'insufficient_data')

export function createCapacityRepository(db, options = {}) {
  const now = options.now || (() => new Date())
  const ensureHostProfile = () => db.capacityHostProfile.upsert({ where: { hostKey: CAPACITY_BASELINE_HOST_KEY }, create: CAPACITY_BASELINE, update: {} })
  const getHostProfile = (id) => db.capacityHostProfile.findUnique({ where: { id } })
  async function createSnapshot(hostProfileId, snapshot) {
    const data = { ...snapshot, hostProfileId, sourcesJson: json(snapshot.sources, []), componentsJson: json(snapshot.components, []), decisionReasonsJson: json(snapshot.decisionReasons, []) }
    delete data.sources; delete data.components; delete data.decisionReasons
    return db.capacitySnapshot.create({ data })
  }
  const snapshotHostIdentity = (host) => ({
    hostKey: host?.hostKey ?? null,
    serverType: host?.serverType ?? null,
    contractedVcpu: host?.vcpu ?? null,
    contractedMemoryMb: host?.memoryTotalMb ?? null,
    contractedDiskMb: host?.diskTotalMb ?? null,
  })
  const latestSnapshot = (hostProfileId) => db.capacitySnapshot.findFirst({ where: { hostProfileId }, orderBy: { collectedAt: 'desc' } })
  const listSnapshots = (hostProfileId, { since, until = now(), limit = 600 } = {}) => db.capacitySnapshot.findMany({ where: { hostProfileId, collectedAt: { ...(since ? { gte: since } : {}), lte: until } }, orderBy: { collectedAt: 'asc' }, take: Math.min(600, Math.max(1, limit)) })
  const listRollups = (hostProfileId, { granularity, since, until = now(), limit = 600 } = {}) => db.capacityRollup.findMany({ where: { hostProfileId, ...(granularity ? { granularity } : {}), bucketStart: { ...(since ? { gte: since } : {}), lte: until } }, orderBy: { bucketStart: 'asc' }, take: Math.min(600, Math.max(1, limit)) })
  async function workerHistorySummary(hostProfileId, { days = 90 } = {}) {
    const until = now(); const since = new Date(until.getTime() - days * 86400000)
    const samples = await db.capacitySnapshot.findMany({ where: { hostProfileId, collectedAt: { gte: since, lte: until } }, orderBy: { collectedAt: 'asc' }, select: { collectedAt: true, fixedBaseMb: true, workerRssP95Mb: true } })
    const quantile = (values) => { const sorted = finite(values).sort((a, b) => a - b); return sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null }
    const first = samples[0]?.collectedAt; const last = samples.at(-1)?.collectedAt
    return { historyDays: first && last ? Math.floor((new Date(last) - new Date(first)) / 86400000) + 1 : 0, fixedBaseP95Mb: quantile(samples.map((item) => item.fixedBaseMb)), workerRssP95Mb: quantile(samples.map((item) => item.workerRssP95Mb)), sampleCount: samples.length }
  }
  async function rollup(hostProfileId, granularity, bucketDate) {
    const bucketStart = floorBucket(bucketDate, granularity)
    const bucketEnd = new Date(bucketStart.getTime() + (granularity === 'day' ? 86400000 : 3600000))
    const samples = await db.capacitySnapshot.findMany({ where: { hostProfileId, collectedAt: { gte: bucketStart, lt: bucketEnd } } })
    if (!samples.length) return null
    const metrics = Object.fromEntries(['memoryAvailableMb', 'memoryFreeMb', 'memoryCacheMb', 'processRssTotalMb', 'diskUsedPercent', 'diskUsedMb', 'diskAvailableMb', 'inodeUsedPercent', 'cpuPercent', 'load1', 'load5', 'load15', 'swapUsedMb', 'swapInKbPerSec', 'swapOutKbPerSec'].map((name) => { const values = finite(samples.map((sample) => sample[name])); return [name, { min: values.length ? Math.min(...values) : null, avg: average(values), max: values.length ? Math.max(...values) : null }] }))
    const peak = (name, fn = Math.max) => { const values = finite(samples.map((s) => s[name])); return values.length ? fn(...values) : null }
    const payload = { hostProfileId, granularity, bucketStart, sampleCount: samples.length, expectedSampleCount: granularity === 'day' ? 24 : 1, metricsJson: json(metrics, {}), sessionPeak: peak('connectedSessions'), workerPeak: peak('productionWorkers'), safeLimitMin: peak('safeSessionLimit', Math.min), worstState: worst(samples.map((s) => s.operationalState)), policyVersionsJson: json([...new Set(samples.map((s) => s.policyVersion).filter(Boolean))], []) }
    return db.capacityRollup.upsert({ where: { hostProfileId_granularity_bucketStart: { hostProfileId, granularity, bucketStart } }, create: payload, update: payload })
  }
  const applyRetention = (reference = now()) => Promise.all([
    db.capacitySnapshot.deleteMany({ where: { collectedAt: { lt: new Date(reference.getTime() - 90 * 86400000) } } }),
    db.capacityRollup.deleteMany({ where: { granularity: 'hour', bucketStart: { lt: new Date(reference.getTime() - 365 * 86400000) } } }),
  ])
  const createEvent = (hostProfileId, event) => { const { details, ...fields } = event; const data = { ...fields, hostProfileId, detailsJson: json(details, {}) }; return db.capacityEvent.upsert({ where: { dedupeKey: data.dedupeKey }, create: data, update: {} }) }
  const listEvents = (hostProfileId, { since, until, limit = 100 } = {}) => db.capacityEvent.findMany({ where: { hostProfileId, ...(since || until ? { occurredAt: { ...(since ? { gte: since } : {}), ...(until ? { lt: until } : {}) } } : {}) }, orderBy: { occurredAt: 'desc' }, take: Math.min(500, Math.max(1, limit)) })
  const upsertAlert = (alert) => { const { observedValues, ...fields } = alert; const data = { ...fields, observedValuesJson: json(observedValues, {}) }; return db.capacityAlert.upsert({ where: { conditionKey: alert.conditionKey }, create: data, update: data }) }
  const listAlerts = (hostProfileId, { status, limit = 100 } = {}) => db.capacityAlert.findMany({ where: { hostProfileId, ...(status ? { status } : {}) }, orderBy: { lastObservedAt: 'desc' }, take: Math.min(500, Math.max(1, limit)) })
  const updateHostInventory = (hostProfileId, cache) => {
    const profile = cache.profile || {}
    const contract = Object.fromEntries(['hostname','providerServerId','serverType','architecture','vcpu','memoryTotalMb','diskTotalMb','region','ipv4'].filter((key) => profile[key] != null).map((key) => [key, profile[key]]))
    return db.capacityHostProfile.update({ where: { id: hostProfileId }, data: { ...contract, inventoryJson: json(cache.inventory, {}), source: cache.source || 'provider', checkedAt: cache.checkedAt ? new Date(cache.checkedAt) : now(), lastSuccessAt: cache.lastSuccessAt ? new Date(cache.lastSuccessAt) : undefined, errorCode: cache.errorCode ?? null } })
  }
  return { ensureHostProfile, getHostProfile, snapshotHostIdentity, createSnapshot, latestSnapshot, listSnapshots, listRollups, workerHistorySummary, rollup, applyRetention, createEvent, listEvents, upsertAlert, listAlerts, updateHostInventory }
}
