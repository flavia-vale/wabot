export const CAPACITY_SERVICE_VERSION = 'admin-capacity-v1';
import { buildCapacityResponse, sanitizeCapacityComponent, sanitizeCapacitySource } from './contract.js'
import { evaluateCapacity, evaluateResourceHealth } from './policy.js'
import { createCapacityRepository } from './repository.js'
import { forecastCapacity } from './forecast.js'
import { calculateCapacityScenario } from './scenario.js'
import { getCapacityRefreshState, requestCapacityRefresh } from './sweep.js'

const parseArray = (value) => { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
const iso = (value) => value ? new Date(value).toISOString() : null
export function createCapacityService({ db, repository = db ? createCapacityRepository(db) : null, now = () => new Date(), staleAfterMs = 2 * 60 * 60 * 1000, refreshCapacity } = {}) {
  if (!repository) throw new TypeError('capacity service requires db or repository')
  async function current() {
    const host = await repository.ensureHostProfile(); const raw = await repository.latestSnapshot(host.id)
    if (!raw) return buildCapacityResponse({ snapshot: null, state: 'insufficient_data', forecastSummary: { windowDays: 30, centralThresholdAt: null, range: null, confidence: 'insufficient', reasonUnavailable: 'minimum_history' }, activeAlerts: [], refreshInProgress: getCapacityRefreshState().inProgress, sources: [{ name: 'snapshot', status: 'unavailable', observedAt: null, ageSeconds: null, errorCode: 'NO_SNAPSHOT' }] })
    const collectedAt = new Date(raw.collectedAt); const ageSeconds = Math.max(0, Math.floor((now().getTime() - collectedAt.getTime()) / 1000)); const decision = persistedDecision(raw)
    if (ageSeconds * 1000 > staleAfterMs) { decision.state = 'stale'; decision.reasons.push({ code: 'STALE_SNAPSHOT', severity: 'attention', message: 'A última coleta está desatualizada.' }) }
    const sources = parseArray(raw.sourcesJson).map((source) => sanitizeCapacitySource({ ...source, ageSeconds })); const components = parseArray(raw.componentsJson).map(sanitizeCapacityComponent)
    const memoryUsedMb = raw.memoryTotalMb != null && raw.memoryAvailableMb != null ? Math.max(0, raw.memoryTotalMb - raw.memoryAvailableMb) : null
    const environments = ['production', 'staging'].map((environment) => {
      const apps = components.filter((item) => item.environment === environment)
      const workers = environment === 'production' ? raw.productionWorkers : raw.stagingWorkers
      const rssMb = environment === 'production' ? raw.productionRssMb : raw.stagingRssMb
      const expectedApps = environment === 'production'
        ? ['api', 'dashboard', 'bot-supervisor', 'snapshot-cron']
        : ['api-staging', 'visual-staging', 'bot-supervisor-staging']
      const appStatus = expectedApps.map((key) => {
        const app = apps.find((item) => item.key === key)
        return app || { key, environment, status: 'unknown', pid: null, uptimeSeconds: null, restartCount: null, cpuPercent: null, rssMb: null }
      })
      const onlineCount = appStatus.filter((item) => item.status === 'online').length
      const knownCount = appStatus.filter((item) => item.status !== 'unknown').length
      const status = knownCount === 0 && workers == null
        ? 'unknown'
        : onlineCount === 0 && workers === 0 && knownCount === expectedApps.length
          ? 'offline'
          : onlineCount === expectedApps.length
            ? 'online'
            : 'partial'
      return {
        environment,
        status,
        apps: appStatus,
        workers: workers ?? null,
        rssMb: rssMb ?? null,
        ...(environment === 'staging' ? {
          controlScope: {
            managedApps: ['api-staging', 'visual-staging'],
            unmanagedApps: ['bot-supervisor-staging'],
            message: 'O controle liga/desliga somente API e dashboard; o supervisor de staging permanece independente.'
          }
        } : {})
      }
    })
    const divergences = []
    if (raw.connectedSessions != null && raw.productionWorkers != null && raw.connectedSessions !== raw.productionWorkers) divergences.push({ code: 'SESSION_WORKER_DIVERGENCE', connectedSessions: raw.connectedSessions, productionWorkers: raw.productionWorkers, message: 'Sessões conectadas e workers de produção divergem.' })
    if (raw.activeCustomers != null && raw.productionWorkers != null && raw.activeCustomers !== raw.productionWorkers) divergences.push({ code: 'ACTIVE_CUSTOMER_WORKER_DIVERGENCE', activeCustomers: raw.activeCustomers, productionWorkers: raw.productionWorkers, message: 'Clientes ativos e workers de produção divergem; nenhum contador foi assumido como correto.' })
    if (raw.activeCustomers != null && raw.connectedSessions != null && raw.activeCustomers !== raw.connectedSessions) divergences.push({ code: 'ACTIVE_CUSTOMER_SESSION_DIVERGENCE', activeCustomers: raw.activeCustomers, connectedSessions: raw.connectedSessions, message: 'Clientes ativos e sessões conectadas divergem; verifique os três contadores.' })
    const staging = environments.find((item) => item.environment === 'staging'); const stagingSuggestion = ['online', 'partial'].includes(staging?.status) && staging.workers === 0 ? { action: 'consider_shutdown', message: 'Staging está parcial ou ligado sem workers; desligue somente se não houver validação em curso. O supervisor não faz parte desse controle.' } : null
    let inventory = {}; try { inventory = JSON.parse(host.inventoryJson || '{}') } catch {}
    const inventoryReferenceAt = host.lastSuccessAt || host.checkedAt
    const inventoryAgeSeconds = inventoryReferenceAt ? Math.max(0, Math.floor((now() - new Date(inventoryReferenceAt)) / 1000)) : null
    const activeAlerts = repository.listAlerts ? await repository.listAlerts(host.id, { status: 'active', limit: 20 }) : []
    const forecastSummary = await buildForecast(host, now())
    const accountedRssMb = Number.isFinite(raw.classifiedRssTotalMb)
      ? raw.classifiedRssTotalMb
      : Number.isFinite(raw.productionRssMb) && Number.isFinite(raw.stagingRssMb) ? raw.productionRssMb + raw.stagingRssMb : null
    const unaccountedRssMb = Number.isFinite(raw.processRssTotalMb) && Number.isFinite(accountedRssMb)
      ? Math.max(0, raw.processRssTotalMb - accountedRssMb)
      : null
    const knownAppKeys = new Set(['api', 'dashboard', 'bot-supervisor', 'snapshot-cron', 'api-staging', 'visual-staging', 'bot-supervisor-staging'])
    const unclassifiedComponents = components.filter((item) => !knownAppKeys.has(item.key)).map((item) => ({ key: item.key, rssMb: item.rssMb, cpuPercent: item.cpuPercent, status: item.status }))
    return buildCapacityResponse({ snapshot: { collectedAt: iso(collectedAt), ageSeconds, completeness: raw.completeness, host: { hostname: host.hostname, serverType: host.serverType, architecture: host.architecture, vcpu: host.vcpu, memoryTotalMb: host.memoryTotalMb, diskTotalMb: host.diskTotalMb, region: host.region, source: host.source, checkedAt: iso(host.checkedAt), inventoryAgeSeconds, inventory, inventoryStale: !host.lastSuccessAt || now() - new Date(host.lastSuccessAt) > 6 * 3600000, inventoryErrorCode: host.errorCode }, decision, resources: { memory: { totalMb: raw.memoryTotalMb, availableMb: raw.memoryAvailableMb, freeMb: raw.memoryFreeMb, cacheMb: raw.memoryCacheMb, usedMb: memoryUsedMb, processRssMb: raw.processRssTotalMb }, cpu: { percent: raw.cpuPercent, load1: raw.load1, load5: raw.load5, load15: raw.load15 }, disk: { totalMb: raw.diskTotalMb, usedMb: raw.diskUsedMb, availableMb: raw.diskAvailableMb, usedPercent: raw.diskUsedPercent, inodeUsedPercent: raw.inodeUsedPercent }, swap: { totalMb: raw.swapTotalMb, usedMb: raw.swapUsedMb, inKbPerSec: raw.swapInKbPerSec, outKbPerSec: raw.swapOutKbPerSec } }, counts: { connectedSessions: raw.connectedSessions, activeCustomers: raw.activeCustomers, productionWorkers: raw.productionWorkers, stagingWorkers: raw.stagingWorkers }, workerStats: { totalRssMb: raw.workerRssTotalMb, p50RssMb: raw.workerRssP50Mb, p95RssMb: raw.workerRssP95Mb, maxRssMb: raw.workerRssMaxMb }, reconciliation: { observedRssMb: raw.processRssTotalMb, processRssTotalMb: raw.processRssTotalMb, fixedBaseMb: raw.fixedBaseMb, accountedRssMb, unaccountedRssMb, status: accountedRssMb == null || raw.processRssTotalMb == null ? 'unknown' : unaccountedRssMb > 1 ? 'partial' : 'complete', unclassifiedComponents }, environments, components, divergences, stagingSuggestion }, forecastSummary, activeAlerts: activeAlerts.map(presentAlert), refreshInProgress: getCapacityRefreshState().inProgress, sources })
  }
  async function history(period = '30d') {
    const periods = { '24h': { ms: 86400000, granularity: 'raw' }, '7d': { ms: 7 * 86400000, granularity: 'hour' }, '30d': { ms: 30 * 86400000, granularity: 'day' }, '90d': { ms: 90 * 86400000, granularity: 'day' } }
    const selected = periods[period]
    if (!selected) { const error = new Error('Período de capacidade inválido.'); error.code = 'INVALID_CAPACITY_PERIOD'; throw error }
    const host = await repository.ensureHostProfile(); const until = now(); const since = new Date(until.getTime() - selected.ms)
    const raw = selected.granularity === 'raw' || !repository.listRollups ? await repository.listSnapshots(host.id, { since, until, limit: 600 }) : await repository.listRollups(host.id, { granularity: selected.granularity, since, until, limit: 600 })
    const points = raw.map((item) => selected.granularity === 'raw' ? presentHistoryPoint(item.collectedAt, item) : (() => { const metrics = (() => { try { return JSON.parse(item.metricsJson || '{}') } catch { return {} } })(); return presentHistoryPoint(item.bucketStart, { memoryAvailableMb: metrics.memoryAvailableMb?.avg, memoryFreeMb: metrics.memoryFreeMb?.avg, memoryCacheMb: metrics.memoryCacheMb?.avg, processRssTotalMb: metrics.processRssTotalMb?.avg, cpuPercent: metrics.cpuPercent?.avg, load1: metrics.load1?.avg, load5: metrics.load5?.avg, load15: metrics.load15?.avg, diskUsedPercent: metrics.diskUsedPercent?.avg, diskUsedMb: metrics.diskUsedMb?.avg, diskAvailableMb: metrics.diskAvailableMb?.avg, inodeUsedPercent: metrics.inodeUsedPercent?.max, swapUsedMb: metrics.swapUsedMb?.avg, swapInKbPerSec: metrics.swapInKbPerSec?.max, swapOutKbPerSec: metrics.swapOutKbPerSec?.max, connectedSessions: item.sessionPeak, productionWorkers: item.workerPeak, safeSessionLimit: item.safeLimitMin, operationalState: item.worstState, sampleCount: item.sampleCount, expectedSampleCount: item.expectedSampleCount }) })())
    const events = repository.listEvents ? await repository.listEvents(host.id, { since, until, limit: 100 }) : []
    const expectedPoints = selected.granularity === 'raw' ? 24 : selected.granularity === 'hour' ? Math.ceil(selected.ms / 3600000) : Math.ceil(selected.ms / 86400000)
    return { version: CAPACITY_SERVICE_VERSION, period, granularity: selected.granularity, since: iso(since), until: iso(until), points, events: events.map((event) => ({ type: event.type, occurredAt: iso(event.occurredAt), severity: event.severity, title: event.title, source: event.source })), coverage: { pointCount: points.length, expectedPoints, ratio: expectedPoints ? Math.min(1, points.length / expectedPoints) : 0, firstPointAt: points[0]?.at ?? null, lastPointAt: points.at(-1)?.at ?? null } }
  }
  async function forecast() {
    const host = await repository.ensureHostProfile(); const until = now()
    return { version: CAPACITY_SERVICE_VERSION, generatedAt: iso(until), ...await buildForecast(host, until) }
  }
  async function buildForecast(host, until) {
    const since = new Date(until.getTime() - 90 * 86400000)
    if (!repository.listSnapshots && !repository.listRollups) return forecastCapacity([], { now: until })
    let samples
    if (repository.listRollups) {
      const rollups = await repository.listRollups(host.id, { granularity: 'day', since, until, limit: 100 })
      samples = rollups.map((item) => { let versions = []; try { versions = JSON.parse(item.policyVersionsJson || '[]') } catch {} return { collectedAt: item.bucketStart, connectedSessions: item.sessionPeak, productionWorkers: item.workerPeak, safeSessionLimit: item.safeLimitMin, policyVersion: versions.length === 1 ? versions[0] : null, hostProfileId: host.id } })
      if (samples.length < 2 && repository.listSnapshots) samples = await repository.listSnapshots(host.id, { since, until, limit: 600 })
    } else samples = await repository.listSnapshots(host.id, { since, until, limit: 600 })
    return forecastCapacity(samples, { now: until })
  }
  async function scenario(input) {
    const status = await current(); const snapshot = status.snapshot
    if (!snapshot?.decision?.safeLimit) { const error = new Error('Aguarde uma coleta completa antes de simular crescimento.'); error.code = 'CAPACITY_SCENARIO_BASELINE_UNAVAILABLE'; throw error }
    const staging = snapshot.environments?.find((item) => item.environment === 'staging')
    return { version: CAPACITY_SERVICE_VERSION, baselineAt: snapshot.collectedAt, ...calculateCapacityScenario(input, { currentSessions: snapshot.decision.sessions, safeLimit: snapshot.decision.safeLimit, sessionCostMb: snapshot.decision.sessionCostMb, bottleneck: snapshot.decision.bottleneck, policyVersion: snapshot.decision.policyVersion, calculatedAt: now(), stagingCurrentlyOn: ['online', 'partial'].includes(staging?.status), stagingMemoryMb: staging?.rssMb }) }
  }
  async function alerts({ status, limit = 100 } = {}) { const host = await repository.ensureHostProfile(); return { version: CAPACITY_SERVICE_VERSION, alerts: (await repository.listAlerts(host.id, { status, limit })).map(presentAlert) } }
  function refresh() { return refreshCapacity ? refreshCapacity() : requestCapacityRefresh() }
  return { current, history, forecast, scenario, alerts, refresh }
}

function persistedDecision(raw) {
  let reasons = []; try { reasons = JSON.parse(raw.decisionReasonsJson || '[]') } catch {}
  // RCA 2026-09-05: a decisão persistida voltava SEM `resourceHealth`, e era ele
  // que a tela usa para pintar RAM/CPU/disco/swap. Resultado: o bloco
  // "Diagnóstico traduzido" dizia "Sem medição" nos quatro cartões mesmo com o
  // servidor medido e saudável — e "sem medição" nunca significa saudável, então
  // a leitura ficava permanentemente inútil. A saúde é derivada das medições
  // brutas do próprio snapshot (função pura, sem consulta nova).
  if (raw.policyVersion && raw.safeSessionLimit != null) return { policyVersion: raw.policyVersion, state: raw.operationalState, resourceHealth: evaluateResourceHealth(raw).resources, safeLimit: raw.safeSessionLimit, estimatedMaximum: raw.estimatedMaximum, reserveMb: raw.reserveMb, sessionCostMb: raw.sessionCostMb, fixedBaseBudgetMb: raw.fixedBaseBudgetMb, headroomSessions: raw.headroomSessions, headroomMemoryMb: raw.headroomMemoryMb, bottleneck: raw.bottleneck, sessions: [raw.connectedSessions, raw.productionWorkers].filter(Number.isFinite).length ? Math.max(...[raw.connectedSessions, raw.productionWorkers].filter(Number.isFinite)) : null, reasons }
  return evaluateCapacity(raw)
}

function presentHistoryPoint(at, item) { return { at: iso(at), memoryAvailableMb: item.memoryAvailableMb ?? null, memoryFreeMb: item.memoryFreeMb ?? null, memoryCacheMb: item.memoryCacheMb ?? null, processRssTotalMb: item.processRssTotalMb ?? null, cpuPercent: item.cpuPercent ?? null, load1: item.load1 ?? null, load5: item.load5 ?? null, load15: item.load15 ?? null, diskUsedMb: item.diskUsedMb ?? null, diskAvailableMb: item.diskAvailableMb ?? null, diskUsedPercent: item.diskUsedPercent ?? null, inodeUsedPercent: item.inodeUsedPercent ?? null, swapUsedMb: item.swapUsedMb ?? null, swapInKbPerSec: item.swapInKbPerSec ?? null, swapOutKbPerSec: item.swapOutKbPerSec ?? null, connectedSessions: item.connectedSessions ?? null, productionWorkers: item.productionWorkers ?? null, safeSessionLimit: item.safeSessionLimit ?? null, state: item.operationalState ?? item.state ?? null, sampleCount: item.sampleCount ?? null, expectedSampleCount: item.expectedSampleCount ?? null } }

function presentAlert(alert) { let observedValues = {}; try { observedValues = JSON.parse(alert.observedValuesJson || '{}') } catch {} return { id: alert.id, type: alert.type, status: alert.status, severity: alert.severity, firstObservedAt: iso(alert.firstObservedAt), lastObservedAt: iso(alert.lastObservedAt), recoveredAt: iso(alert.recoveredAt), observedValues, recommendation: alert.recommendation } }
