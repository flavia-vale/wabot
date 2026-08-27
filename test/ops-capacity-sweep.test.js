import test from 'node:test'
import assert from 'node:assert/strict'
import { getCapacityRefreshState, requestCapacityRefresh, resetCapacityRefreshForTests, startCapacitySweep } from '../src/ops/capacity/sweep.js'
import { readFile } from 'node:fs/promises'

test('server encaminha roots operacionais validados ao coletor', async () => {
  const source = await readFile(new URL('../src/api/server.js', import.meta.url), 'utf8')
  assert.match(source, /resolveProcessRoots\(process\.env\)/)
  assert.match(source, /processOptions:\s*\{\s*roots:\s*capacityProcessRoots\s*\}/)
})
import { evaluateCapacityAlerts } from '../src/ops/capacity/alerts.js'
import { createCapacityService } from '../src/ops/capacity/service.js'
test('sweep executa no boot, persiste e agenda timer unref', async () => { const calls = []; let tick; let unref = false; const repository = { ensureHostProfile: async () => ({ id: 'h' }), createSnapshot: async (_, value) => ({ ...value, collectedAt: new Date() }), rollup: async (_, kind) => calls.push(kind), applyRetention: async () => calls.push('retention') }; startCapacitySweep({ repository, collect: async () => ({ completeness: 'partial' }), setInterval: (fn, ms) => { tick = fn; calls.push(ms); return { unref: () => { unref = true } } } }); await new Promise(setImmediate); assert.equal(unref, true); assert.equal(typeof tick, 'function'); assert.ok(calls.includes(300000)); assert.ok(calls.includes('hour')); assert.ok(calls.includes('day')) })
test('sweep persiste contagens e decisao completa usando historico confiavel', async () => {
  let persisted
  const repository = { ensureHostProfile: async () => ({ id: 'h' }), latestSnapshot: async () => null, workerHistorySummary: async () => ({ historyDays: 20, fixedBaseP95Mb: 1600, workerRssP95Mb: 410 }), createSnapshot: async (_, value) => (persisted = value, { ...value, collectedAt: new Date() }), rollup: async () => {}, applyRetention: async () => {} }
  const { tick } = startCapacitySweep({ repository, collect: async () => ({ completeness: 'complete', memoryTotalMb: 8192, connectedSessions: 17, activeCustomers: 19, productionWorkers: 17, fixedBaseMb: 1200, workerRssP95Mb: 340, sources: [], components: [] }), setInterval: () => ({ unref() {} }) })
  await tick()
  assert.equal(persisted.policyVersion, 'capacity-policy-v1')
  assert.equal(persisted.operationalState, 'critical')
  assert.equal(persisted.safeSessionLimit, 15)
  assert.equal(persisted.connectedSessions, 17)
  assert.ok(Array.isArray(persisted.decisionReasons))
})
test('refresh distingue nao inicializado e preserva single-flight real', async () => {
  resetCapacityRefreshForTests()
  assert.deepEqual(requestCapacityRefresh(), { accepted: false, inProgress: false, reason: 'NOT_INITIALIZED' })
  let release; const pending = new Promise((resolve) => { release = resolve })
  startCapacitySweep({ repository: { ensureHostProfile: async () => ({ id: 'h' }), latestSnapshot: async () => null, createSnapshot: async (_, x) => x, rollup: async () => {}, applyRetention: async () => {} }, collect: () => pending.then(() => ({ completeness: 'partial', sources: [], components: [] })), setInterval: () => ({ unref() {} }) })
  assert.equal(getCapacityRefreshState().inProgress, true)
  assert.equal(requestCapacityRefresh().reason, 'COLLECTION_IN_PROGRESS')
  release(); await new Promise(setImmediate); await new Promise(setImmediate)
  assert.equal(getCapacityRefreshState().inProgress, false)
})

test('fluxo de producao integra coleta, decisao persistida, consultas, cenario e alertas', async () => {
  resetCapacityRefreshForTests()
  const now = new Date('2026-08-27T15:00:00Z')
  const host = { id: 'cx33', hostname: 'wabot-prod', serverType: 'CX33', architecture: 'x86', vcpu: 4, memoryTotalMb: 8192, diskTotalMb: 40960, source: 'provider', checkedAt: now, lastSuccessAt: now, inventoryJson: '{"servers":[{"name":"wabot-prod","serverType":"CX33"}]}' }
  const snapshots = Array.from({ length: 9 }, (_, index) => ({ id: `history-${index}`, hostProfileId: host.id, collectedAt: new Date(now.getTime() - (9 - index) * 86400000), connectedSessions: 4 + index, productionWorkers: 4 + index, safeSessionLimit: 14, policyVersion: 'capacity-policy-v1', operationalState: 'healthy' }))
  const alerts = new Map()
  const events = []
  const repository = {
    ensureHostProfile: async () => host,
    latestSnapshot: async () => snapshots.at(-1) || null,
    workerHistorySummary: async () => ({ historyDays: 30, fixedBaseP95Mb: 1200, workerRssP95Mb: 350 }),
    createSnapshot: async (hostProfileId, value) => { const saved = { id: `current-${snapshots.length}`, hostProfileId, collectedAt: now, ...value, sourcesJson: JSON.stringify(value.sources), componentsJson: JSON.stringify(value.components), decisionReasonsJson: JSON.stringify(value.decisionReasons) }; snapshots.push(saved); return saved },
    listSnapshots: async (_hostId, { since, until, limit }) => snapshots.filter((row) => row.collectedAt >= since && row.collectedAt <= until).slice(-limit),
    listRollups: async () => [],
    listEvents: async () => events,
    createEvent: async (_hostId, event) => events.push({ ...event, occurredAt: now }),
    listAlerts: async (_hostId, query = {}) => [...alerts.values()].filter((alert) => !query.status || alert.status === query.status).slice(0, query.limit || 500),
    upsertAlert: async (alert) => { const saved = { ...alert, id: alert.conditionKey, observedValuesJson: JSON.stringify(alert.observedValues) }; alerts.set(alert.type, saved); return saved },
    rollup: async () => {},
    applyRetention: async () => {},
  }
  const measurement = { completeness: 'complete', memoryTotalMb: 8192, memoryAvailableMb: 1800, memoryFreeMb: 300, memoryCacheMb: 1500, processRssTotalMb: 5900, cpuPercent: 8, load1: .2, load5: .15, load15: .1, diskTotalMb: 40960, diskUsedMb: 32000, diskAvailableMb: 8960, diskUsedPercent: 78.125, inodeUsedPercent: 14, swapTotalMb: 4096, swapUsedMb: 795, swapInKbPerSec: 0, swapOutKbPerSec: 0, connectedSessions: 12, activeCustomers: 13, productionWorkers: 12, stagingWorkers: 0, productionRssMb: 4200, stagingRssMb: 315, stagingOnline: true, fixedBaseMb: 1200, workerRssTotalMb: 4000, workerRssP50Mb: 300, workerRssP95Mb: 350, workerRssMaxMb: 380, oomKillCount: 0, sources: [{ name: 'linux', status: 'ok', observedAt: now.toISOString() }, { name: 'processes', status: 'ok', observedAt: now.toISOString() }], components: [{ key: 'api', environment: 'production', status: 'online', rssMb: 170, uptimeSeconds: 4000 }, { key: 'api-staging', environment: 'staging', status: 'online', rssMb: 128, uptimeSeconds: 4000 }] }
  const evaluateAlerts = (saved, currentHost, previous) => evaluateCapacityAlerts({ repository, host: currentHost, snapshot: saved, previous, now })
  const { tick } = startCapacitySweep({ repository, collect: async () => ({ ...measurement }), evaluateAlerts, setInterval: () => ({ unref() {} }) })
  await tick() // joins the boot collection
  await tick() // confirms alert conditions with a second production sample

  const service = createCapacityService({ repository, now: () => now })
  const current = await service.current()
  assert.equal(current.snapshot.host.serverType, 'CX33')
  assert.equal(current.snapshot.decision.policyVersion, 'capacity-policy-v1')
  assert.equal(current.snapshot.counts.connectedSessions, 12)
  assert.equal(current.snapshot.resources.disk.usedPercent, 78.125)
  assert.ok(current.snapshot.decision.safeLimit > current.snapshot.decision.sessions)
  assert.ok(current.activeAlerts.some((alert) => alert.type === 'disk_usage' && alert.status === 'active'))
  assert.equal(current.activeAlerts.some((alert) => alert.type === 'staging_idle'), false)

  const history = await service.history('24h')
  assert.ok(history.points.some((point) => point.connectedSessions === 12 && point.diskUsedPercent === 78.125))
  const forecast = await service.forecast()
  assert.equal(forecast.reasonUnavailable, null)
  assert.ok(forecast.centralThresholdAt)
  assert.equal(forecast.growth[7].net > 0, true)
  const scenario = await service.scenario({ newCustomers: 20, horizonMonths: 1, activationPercent: 100, stagingExpectedOn: false })
  assert.equal(scenario.projectedSessions, 32)
  assert.equal(scenario.deficitSessions > 0, true)
  const active = await service.alerts({ status: 'active' })
  assert.ok(active.alerts.length >= 2)
  assert.equal(JSON.stringify({ current, history, forecast, scenario, active }).includes('HCLOUD'), false)
})

test('current preserva decisão persistida com p95 confiável acima do piso', async () => {
  const now = new Date('2026-08-27T15:00:00Z')
  const raw = { collectedAt: now, completeness: 'complete', memoryTotalMb: 8192, connectedSessions: 10, productionWorkers: 10, policyVersion: 'capacity-policy-v1', operationalState: 'attention', safeSessionLimit: 15, estimatedMaximum: 17, reserveMb: 1600, sessionCostMb: 410, headroomSessions: 5, headroomMemoryMb: 492, bottleneck: 'memory', decisionReasonsJson: '[]', sourcesJson: '[]', componentsJson: '[]' }
  const repository = { ensureHostProfile: async () => ({ id: 'h', inventoryJson: '{}' }), latestSnapshot: async () => raw, listAlerts: async () => [], listRollups: async () => [], listSnapshots: async () => [] }
  const current = await createCapacityService({ repository, now: () => now }).current()
  assert.equal(current.snapshot.decision.sessionCostMb, 410)
  assert.equal(current.snapshot.decision.safeLimit, 15)
  const scenario = await createCapacityService({ repository, now: () => now }).scenario({ newCustomers: 1, horizonMonths: 1, activationPercent: 100, stagingExpectedOn: false })
  assert.match(scenario.assumptions.join(' '), /410 MB/)
})

test('falhas consecutivas avaliam staleness contra o relógio e janela ociosa atravessa 24h', async () => {
  resetCapacityRefreshForTests()
  let now = new Date('2026-08-28T00:01:00Z')
  const previous = { collectedAt: new Date('2026-08-27T23:40:00Z'), stagingOnline: true, stagingWorkers: 0 }
  const snapshots = [{ collectedAt: new Date('2026-08-26T23:59:00Z'), stagingOnline: true, stagingWorkers: 0 }, previous]
  const evaluated = []
  const repository = { ensureHostProfile: async () => ({ id: 'h' }), latestSnapshot: async () => previous, listSnapshots: async () => snapshots, listRollups: async () => [], applyRetention: async () => {} }
  const { tick } = startCapacitySweep({ repository, now: () => now, collect: async () => { throw Object.assign(new Error('offline'), { code: 'LINUX_UNAVAILABLE' }) }, evaluateAlerts: async (snapshot) => evaluated.push(snapshot), logger: { warn() {} }, setInterval: () => ({ unref() {} }) })
  await tick()
  now = new Date('2026-08-28T00:06:00Z')
  await tick()
  assert.equal(evaluated.length >= 2, true)
  assert.equal(evaluated.at(-1).collectedAt.getTime(), previous.collectedAt.getTime())
  assert.equal(evaluated.at(-1).stagingIdleMinutes >= 24 * 60, true)
})

test('wiring real persiste identidade e deduplica deploy e mudança de capacidade', async () => {
  resetCapacityRefreshForTests()
  const host = { id: 'h', hostKey: 'hetzner:1', serverType: 'CX33', vcpu: 4, memoryTotalMb: 8192, diskTotalMb: 40960 }
  const snapshots = []
  const events = new Map()
  const repository = {
    ensureHostProfile: async () => ({ ...host }),
    snapshotHostIdentity: (value) => ({ hostKey: value.hostKey, serverType: value.serverType, contractedVcpu: value.vcpu, contractedMemoryMb: value.memoryTotalMb, contractedDiskMb: value.diskTotalMb }),
    latestSnapshot: async () => snapshots.at(-1) || null,
    workerHistorySummary: async () => ({}),
    createSnapshot: async (hostProfileId, value) => { const saved = { id: `s${snapshots.length}`, hostProfileId, collectedAt: new Date(`2026-08-27T12:0${snapshots.length}:00Z`), ...value, componentsJson: JSON.stringify(value.components || []) }; snapshots.push(saved); return saved },
    createEvent: async (_hostId, value) => { if (!events.has(value.dedupeKey)) events.set(value.dedupeKey, value); return events.get(value.dedupeKey) },
    rollup: async () => {}, applyRetention: async () => {},
  }
  const collect = async () => ({ completeness: 'complete', memoryTotalMb: 8192, components: [], sources: [] })
  const timer = () => ({ unref() {} })

  let sweep = startCapacitySweep({ repository, collect, deploymentRevision: '111111111111', refreshInventory: async () => { Object.assign(host, { serverType: 'CX43', vcpu: 8, memoryTotalMb: 16384 }) }, setInterval: timer })
  await sweep.tick()
  await sweep.tick()
  resetCapacityRefreshForTests()
  sweep = startCapacitySweep({ repository, collect, deploymentRevision: '222222222222', setInterval: timer })
  await sweep.tick()
  await sweep.tick()

  assert.equal(snapshots[0].serverType, 'CX33')
  assert.equal(snapshots[1].serverType, 'CX43')
  assert.equal(snapshots.at(-1).deploymentRevision, '222222222222')
  assert.equal([...events.values()].filter((item) => item.type === 'host_capacity_changed').length, 1)
  assert.equal([...events.values()].filter((item) => item.type === 'deploy').length, 1)
  assert.deepEqual([...events.values()].find((item) => item.type === 'deploy').details, { revision: '222222222222' })
})

test('snapshot failed não substitui último bom e collection_stale ativa e recupera', async () => {
  resetCapacityRefreshForTests()
  let now = new Date('2026-08-27T12:16:00Z'); let fail = true; let creates = 0
  const host = { id: 'h' }; const good = { collectedAt: new Date('2026-08-27T12:00:00Z'), completeness: 'complete', policyVersion: 'capacity-policy-v1' }
  const alerts = new Map()
  const repository = {
    ensureHostProfile: async () => host,
    latestSnapshot: async () => good,
    listSnapshots: async () => [good], listRollups: async () => [],
    createSnapshot: async (_id, value) => { creates++; return { ...value, collectedAt: now } },
    listAlerts: async () => [...alerts.values()],
    upsertAlert: async (value) => { const saved = { ...value, observedValuesJson: JSON.stringify(value.observedValues) }; alerts.set(value.type, saved); return saved },
    createEvent: async () => {}, rollup: async () => {}, applyRetention: async () => {},
  }
  const evaluateAlerts = (snapshot, currentHost, previous) => evaluateCapacityAlerts({ repository, host: currentHost, snapshot, previous, now })
  const { tick } = startCapacitySweep({ repository, now: () => now, collect: async () => fail ? ({ completeness: 'failed', collectedAt: now }) : ({ ...good, collectedAt: now, sources: [], components: [] }), evaluateAlerts, setInterval: () => ({ unref() {} }) })
  await tick(); now = new Date('2026-08-27T12:21:00Z'); await tick()
  assert.equal(creates, 0)
  assert.equal(alerts.get('collection_stale').status, 'active')
  fail = false; now = new Date('2026-08-27T12:22:00Z'); await tick()
  now = new Date('2026-08-27T12:23:00Z'); await tick()
  assert.equal(creates, 2)
  assert.equal(alerts.get('collection_stale').status, 'recovered')
})
