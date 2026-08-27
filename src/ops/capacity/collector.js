import { collectLinuxMetrics } from './linuxMetrics.js'
import { collectProcessMetrics } from './processMetrics.js'
import { sanitizeCapacityComponent, sanitizeCapacitySource } from './contract.js'

let collecting = false
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms); timer.unref?.() })])
const failedSource = (name, error) => ({ name, status: 'unavailable', observedAt: new Date().toISOString(), ageSeconds: 0, errorCode: error?.code === 'TIMEOUT' ? 'SOURCE_TIMEOUT' : 'SOURCE_UNAVAILABLE' })
const sum = (values) => values.reduce((a, b) => a + b, 0)
const percentile = (values, fraction) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * fraction) - 1] }

export async function collectCapacitySnapshot(options = {}) {
  if (collecting) return { skipped: true, reason: 'COLLECTION_IN_PROGRESS' }
  collecting = true
  const clock = options.now || Date.now
  const started = clock()
  try {
    const sourceTimeoutMs = Math.min(10000, options.timeoutMs ?? 9000)
    const run = async (name, operation) => { try { return { value: await withTimeout(Promise.resolve().then(operation), sourceTimeoutMs), source: { name, status: 'ok', observedAt: new Date().toISOString(), ageSeconds: 0, errorCode: null } } } catch (error) { return { value: null, source: failedSource(name, error) } } }
    const results = await Promise.all([
      run('linux', () => (options.collectLinux || collectLinuxMetrics)({ ...(options.linuxOptions || {}), previous: options.linuxState?.sample ?? options.linuxOptions?.previous, nowMs: started })),
      run('processes', () => (options.collectProcesses || collectProcessMetrics)(options.processOptions)),
      ...(options.collectDatabase ? [run('database', options.collectDatabase)] : []),
    ])
    const [linuxResult, processResult, databaseResult] = results
    const linux = linuxResult.value; const processes = processResult.value; const database = databaseResult?.value ?? null
    if (options.linuxState && linux?.sample) options.linuxState.sample = linux.sample
    const workers = processes?.workers || []; const prod = workers.filter((w) => w.environment === 'production'); const stage = workers.filter((w) => w.environment === 'staging')
    const components = (processes?.components || []).map(sanitizeCapacityComponent)
    const rss = prod.map((w) => w.rssMb).filter(Number.isFinite)
    const classifiedRssTotalMb = sum(components.map((c) => c.rssMb).filter(Number.isFinite)) + sum(workers.map((w) => w.rssMb).filter(Number.isFinite))
    const processRssTotalMb = Number.isFinite(processes?.hostRssTotalMb) ? processes.hostRssTotalMb : null
    const sources = [linuxResult.source, processResult.source, ...(databaseResult ? [databaseResult.source] : []), ...Object.entries(processes?.sources || {}).map(([name, value]) => ({ name, ...value, observedAt: new Date().toISOString(), ageSeconds: 0 }))].map(sanitizeCapacitySource)
    return { collectedAt: new Date(started), durationMs: Math.max(0, clock() - started), completeness: [linux, processes].every(Boolean) && (!databaseResult || database) ? 'complete' : ([linux, processes, database].some(Boolean) ? 'partial' : 'failed'), operationalState: 'insufficient_data', oomKillCount: linux?.oomKillCount ?? null, cpuPercent: linux?.cpu?.percent ?? null, load1: linux?.cpu?.load?.[0] ?? null, load5: linux?.cpu?.load?.[1] ?? null, load15: linux?.cpu?.load?.[2] ?? null, uptimeSeconds: linux?.cpu?.uptimeSeconds == null ? null : Math.round(linux.cpu.uptimeSeconds), memoryTotalMb: linux?.memory?.totalMb ?? null, memoryFreeMb: linux?.memory?.freeMb ?? null, memoryAvailableMb: linux?.memory?.availableMb ?? null, memoryCacheMb: linux?.memory?.cacheMb ?? null, swapTotalMb: linux?.memory?.swapTotalMb ?? null, swapUsedMb: linux?.memory?.swapUsedMb ?? null, swapInKbPerSec: linux?.swapRates?.inKbPerSec ?? null, swapOutKbPerSec: linux?.swapRates?.outKbPerSec ?? null, diskTotalMb: linux?.disk?.totalMb ?? null, diskUsedMb: linux?.disk?.usedMb ?? null, diskAvailableMb: linux?.disk?.availableMb ?? null, diskUsedPercent: linux?.disk?.usedPercent ?? null, inodeUsedPercent: linux?.disk?.inodeUsedPercent ?? null, connectedSessions: Number.isInteger(database?.connectedSessions) ? database.connectedSessions : null, activeCustomers: Number.isInteger(database?.activeCustomers) ? database.activeCustomers : null, processRssTotalMb: processRssTotalMb == null ? null : Math.round(processRssTotalMb), fixedBaseMb: processRssTotalMb == null ? null : Math.max(0, Math.round(processRssTotalMb - sum(rss))), productionWorkers: prod.length, stagingWorkers: stage.length, workerRssTotalMb: Math.round(sum(rss)), workerRssP50Mb: percentile(rss, .5) == null ? null : Math.round(percentile(rss, .5)), workerRssP95Mb: percentile(rss, .95) == null ? null : Math.round(percentile(rss, .95)), workerRssMaxMb: rss.length ? Math.round(Math.max(...rss)) : null, productionRssMb: Math.round(sum(components.filter((c) => c.environment === 'production').map((c) => c.rssMb).filter(Number.isFinite)) + sum(rss)), stagingRssMb: Math.round(sum(components.filter((c) => c.environment === 'staging').map((c) => c.rssMb).filter(Number.isFinite)) + sum(stage.map((w) => w.rssMb).filter(Number.isFinite))), classifiedRssTotalMb: Math.round(classifiedRssTotalMb), stagingOnline: components.some((c) => c.environment === 'staging' && c.status === 'online'), sources, components }
  } catch (error) { return { collectedAt: new Date(started), durationMs: Math.max(0, clock() - started), completeness: 'failed', operationalState: 'insufficient_data', sources: [failedSource('collector', error)], components: [] } }
  finally { collecting = false }
}
