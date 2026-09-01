import { collectCapacitySnapshot } from './collector.js'
import { createCapacityRepository } from './repository.js'
import { deriveCapacityEvents } from './events.js'
import { evaluateCapacity } from './policy.js'
import { forecastCapacity } from './forecast.js'
let manualTick = null
let runningPromise = null
export function getCapacityRefreshState() { return { initialized: Boolean(manualTick), inProgress: Boolean(runningPromise) } }
export function resetCapacityRefreshForTests() { manualTick = null; runningPromise = null }
export function requestCapacityRefresh() {
  if (!manualTick) return { accepted: false, inProgress: false, reason: 'NOT_INITIALIZED' }
  if (runningPromise) return { accepted: false, inProgress: true, reason: 'COLLECTION_IN_PROGRESS' }
  void manualTick()
  return { accepted: true, inProgress: true }
}

export const DEFAULT_CAPACITY_SWEEP_INTERVAL_MS = 60 * 60 * 1000
export function startCapacitySweep(options = {}) {
  if (!options.repository && !options.db) throw new TypeError('capacity sweep requires db or repository')
  const repository = options.repository || createCapacityRepository(options.db)
  const collect = options.collect || collectCapacitySnapshot
  const collectOptions = { ...(options.collectOptions || {}), linuxState: options.collectOptions?.linuxState || {} }
  const logger = options.logger || console
  const intervalMs = Math.max(60000, Number(options.intervalMs ?? process.env.CAPACITY_SWEEP_INTERVAL_MS) || DEFAULT_CAPACITY_SWEEP_INTERVAL_MS)
  const alertContext = async (host, snapshot) => {
    const reference = options.now ? options.now() : new Date()
    const since = new Date(reference.getTime() - 90 * 86400000)
    let forecastSamples = repository.listRollups ? await repository.listRollups(host.id, { granularity: 'day', since, until: reference, limit: 100 }) : []
    forecastSamples = forecastSamples.map((item) => { let versions = []; try { versions = JSON.parse(item.policyVersionsJson || '[]') } catch {} return { collectedAt: item.bucketStart, connectedSessions: item.sessionPeak, productionWorkers: item.workerPeak, safeSessionLimit: item.safeLimitMin, policyVersion: versions.length === 1 ? versions[0] : null, hostProfileId: host.id } })
    // Query beyond the threshold so a moving `since` boundary cannot keep an
    // otherwise continuous 24h staging-idle window forever below 24 hours.
    const samples = repository.listSnapshots ? await repository.listSnapshots(host.id, { since: new Date(reference.getTime() - 25 * 3600000), until: reference, limit: 600 }) : []
    if (forecastSamples.length < 2) forecastSamples = samples
    const forecast = forecastCapacity(forecastSamples, { now: reference })
    const horizonDays = forecast.centralThresholdAt ? Math.max(0, (new Date(forecast.centralThresholdAt) - reference) / 86400000) : null
    const idleWindow = [...samples].sort((a, b) => new Date(a.collectedAt) - new Date(b.collectedAt))
    let idleSince = null
    for (const row of idleWindow) idleSince = row.stagingOnline === true && Number(row.stagingWorkers || 0) === 0 ? (idleSince || new Date(row.collectedAt)) : null
    const stagingIdleMinutes = idleSince ? (reference - idleSince) / 60000 : 0
    return { ...snapshot, forecastHorizonDays: horizonDays, stagingIdleMinutes }
  }
  const runTick = async () => { const startedAt = Date.now(); let host; let previous; try { host = await repository.ensureHostProfile(); previous = await repository.latestSnapshot?.(host.id); const snapshot = await collect(collectOptions); if (snapshot?.skipped) return snapshot; if (!snapshot || snapshot.completeness === 'failed') { if (host && previous && options.evaluateAlerts) await options.evaluateAlerts(await alertContext(host, previous), host, previous); options.observe?.({ outcome: 'failure', durationMs: Date.now() - startedAt }); return null } const history = await repository.workerHistorySummary?.(host.id) || {}; const decision = evaluateCapacity({ ...snapshot, fixedBaseP95Mb: history.fixedBaseP95Mb ?? snapshot.fixedBaseMb, workerRssP95Mb: history.workerRssP95Mb ?? snapshot.workerRssP95Mb, workerHistoryDays: history.historyDays ?? 0 }); Object.assign(snapshot, { ...(repository.snapshotHostIdentity?.(host) || {}), deploymentRevision: options.deploymentRevision || null, policyVersion: decision.policyVersion, safeSessionLimit: decision.safeLimit, estimatedMaximum: decision.estimatedMaximum, reserveMb: decision.reserveMb, sessionCostMb: decision.sessionCostMb, fixedBaseBudgetMb: decision.fixedBaseBudgetMb, headroomSessions: decision.headroomSessions, headroomMemoryMb: decision.headroomMemoryMb, bottleneck: decision.bottleneck, operationalState: decision.state, decisionReasons: decision.reasons }); const saved = await repository.createSnapshot(host.id, snapshot); const events = (options.deriveEvents || deriveCapacityEvents)(previous, { ...saved, components: snapshot.components }); const alerted = options.evaluateAlerts ? alertContext(host, saved).then((value) => options.evaluateAlerts(value, host, previous)) : null; await Promise.allSettled([repository.rollup(host.id, 'hour', saved.collectedAt), repository.rollup(host.id, 'day', saved.collectedAt), ...events.map((item) => repository.createEvent?.(host.id, item)), options.refreshInventory?.(host), alerted, repository.applyRetention()]); const durationMs = Date.now() - startedAt; options.observe?.({ outcome: 'success', durationMs }); if (durationMs > (options.slowCollectionMs || 10000)) logger.warn?.({ durationMs }, 'capacity: coleta lenta'); return saved } catch (error) { const durationMs = Date.now() - startedAt; options.observe?.({ outcome: 'failure', durationMs }); logger.warn?.({ code: error?.code || 'CAPACITY_COLLECTION_FAILED', durationMs }, 'capacity: coleta falhou'); if (host && previous && options.evaluateAlerts) { try { await options.evaluateAlerts(await alertContext(host, previous), host, previous) } catch {} } return null } }
  const tick = () => { if (runningPromise) return runningPromise; runningPromise = Promise.resolve().then(runTick).finally(() => { runningPromise = null }); return runningPromise }
  manualTick = tick
  void tick()
  const timer = (options.setInterval || setInterval)(tick, intervalMs)
  timer.unref?.()
  return { timer, tick }
}
