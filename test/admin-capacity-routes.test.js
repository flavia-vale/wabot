import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCapacityService } from '../src/ops/capacity/service.js'

test('GET current exige tech:read, nao escreve auditoria a cada polling e usa resposta sanitizada', async () => {
  const routes = await readFile(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.match(routes, /app\.get\('\/capacity\/current'[\s\S]*requireAdmin\(req, reply, 'tech:read'\)/)
  const handler = routes.match(/app\.get\('\/capacity\/current'[\s\S]*?\n  \}\)\n/)?.[0] || ''
  assert.doesNotMatch(handler, /writeAdminAuditLog|admin\.capacity\.current\.read/)
  assert.doesNotMatch(routes, /capacity\/current[\s\S]{0,500}HCLOUD_READ_TOKEN/)
})

test('rotas de historico e forecast exigem leitura e periodo estrito', async () => {
  const routes = await readFile(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.match(routes, /app\.get\('\/capacity\/history'[\s\S]*CAPACITY_HISTORY_PERIODS/)
  assert.match(routes, /app\.get\('\/capacity\/forecast'[\s\S]*requireAdmin\(req, reply, 'tech:read'\)/)
  assert.match(routes, /INVALID_CAPACITY_PERIOD/)
})

test('cenario exige tech:read, rejeita campos desconhecidos e não é mutação operacional', async () => {
  const routes = await readFile(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.match(routes, /app\.post\('\/capacity\/scenario'[\s\S]*requireAdmin\(req, reply, 'tech:read'\)/)
  assert.match(routes, /INVALID_CAPACITY_SCENARIO/)
  const handler = routes.match(/app\.post\('\/capacity\/scenario'[\s\S]*?\n  \}\)\n/)?.[0] || ''
  assert.doesNotMatch(handler, /writeAdminAuditLog|createSnapshot|execFile|startBot/)
})

test('alertas exigem tech:read e validam status e limite', async () => {
  const routes = await readFile(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const handler = routes.match(/app\.get\('\/capacity\/alerts'[\s\S]*?\n  \}\)\n/)?.[0] || ''
  assert.match(handler, /requireAdmin\(req, reply, 'tech:read'\)/)
  assert.match(handler, /pending.*active.*recovered/)
  assert.match(handler, /INVALID_CAPACITY_ALERT_STATUS/)
  assert.match(handler, /INVALID_CAPACITY_ALERT_LIMIT/)
  assert.doesNotMatch(handler, /HCLOUD_READ_TOKEN|Authorization|writeAdminAuditLog/)
})

test('refresh exige tech:write, corpo vazio, single-flight 202\/409 e auditoria', async () => {
  const routes = await readFile(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const handler = routes.match(/app\.post\('\/capacity\/refresh'[\s\S]*?\n  \}\)\n/)?.[0] || ''
  assert.match(handler, /requireAdmin\(req, reply, 'tech:write'\)/)
  assert.match(handler, /Object\.keys\(req\.body\)\.length/)
  assert.match(handler, /CAPACITY_REFRESH_BODY_NOT_ALLOWED/)
  assert.match(handler, /requestCapacityRefresh\(\)/)
  assert.match(handler, /code\(409\)/)
  assert.match(handler, /code\(202\)/)
  assert.match(handler, /admin\.capacity\.refresh/)
  assert.doesNotMatch(handler, /createServer|deleteServer|rescale|powerOff|powerOn/)
})

test('servico retorna dados insuficientes, e nunca zeros saudaveis, sem snapshot', async () => {
  const repository = { ensureHostProfile: async () => ({ id: 'host', hostname: 'wabot-prod' }), latestSnapshot: async () => null }
  const result = await createCapacityService({ repository }).current()
  assert.equal(result.version, 'admin-capacity-v1')
  assert.equal(result.snapshot, null)
  assert.equal(result.state, 'insufficient_data')
  assert.equal(result.sources[0].errorCode, 'NO_SNAPSHOT')
})

test('servico marca snapshot antigo como stale e remove campos proibidos', async () => {
  const repository = { ensureHostProfile: async () => ({ id: 'host', hostname: 'wabot-prod', serverType: 'CX33' }), latestSnapshot: async () => ({ collectedAt: new Date('2026-08-27T10:00:00Z'), completeness: 'partial', memoryTotalMb: 8192, memoryAvailableMb: 4096, productionWorkers: 17, sourcesJson: JSON.stringify([{ name: 'linux', status: 'ok', token: 'never' }]), componentsJson: '[]' }) }
  const result = await createCapacityService({ repository, now: () => new Date('2026-08-27T13:00:00Z') }).current()
  assert.equal(result.snapshot.decision.state, 'stale')
  assert.equal(result.sources[0].token, undefined)
})

test('servico expoe recursos, percentis, ambientes e os tres contadores divergentes sanitizados', async () => {
  const repository = { ensureHostProfile: async () => ({ id: 'host', hostname: 'wabot-prod' }), latestSnapshot: async () => ({ collectedAt: new Date(), completeness: 'complete', memoryTotalMb: 8192, memoryAvailableMb: 3900, connectedSessions: 16, activeCustomers: 15, productionWorkers: 17, stagingWorkers: 0, processRssTotalMb: 4500, productionRssMb: 4000, stagingRssMb: 315, workerRssTotalMb: 3996, workerRssP50Mb: 260, workerRssP95Mb: 342, workerRssMaxMb: 343, componentsJson: JSON.stringify([{ key: 'api-staging', environment: 'staging', status: 'online', rssMb: 128, cpuPercent: 2, restartCount: 4, uptimeSeconds: 3600, cmdline: 'secret' }, { key: 'custom-monitor', environment: 'production', status: 'online', rssMb: 85 }]), sourcesJson: '[]' }) }
  const { snapshot } = await createCapacityService({ repository }).current()
  assert.equal(snapshot.workerStats.p95RssMb, 342)
  assert.equal(snapshot.environments[1].status, 'partial')
  assert.equal(snapshot.stagingSuggestion.action, 'consider_shutdown')
  assert.deepEqual(snapshot.environments[1].controlScope.managedApps, ['api-staging', 'visual-staging'])
  assert.deepEqual(snapshot.environments[1].controlScope.unmanagedApps, ['bot-supervisor-staging'])
  assert.equal(snapshot.environments[1].apps.find((app) => app.key === 'api-staging').restartCount, 4)
  assert.equal(snapshot.environments[1].apps.find((app) => app.key === 'bot-supervisor-staging').status, 'unknown')
  assert.equal(snapshot.reconciliation.observedRssMb, 4500)
  assert.equal(snapshot.reconciliation.accountedRssMb, 4315)
  assert.equal(snapshot.reconciliation.unaccountedRssMb, 185)
  assert.equal(snapshot.reconciliation.status, 'partial')
  assert.equal(snapshot.reconciliation.unclassifiedComponents[0].key, 'custom-monitor')
  assert.deepEqual(snapshot.divergences.map((item) => item.code), ['SESSION_WORKER_DIVERGENCE', 'ACTIVE_CUSTOMER_WORKER_DIVERGENCE', 'ACTIVE_CUSTOMER_SESSION_DIVERGENCE'])
  assert.equal(snapshot.components[0].cmdline, undefined)
})

test('conciliação mantém desconhecido como null e staging desconhecido não parece desligado', async () => {
  const repository = { ensureHostProfile: async () => ({ id: 'host', hostname: 'wabot-prod' }), latestSnapshot: async () => ({ collectedAt: new Date(), completeness: 'partial', memoryTotalMb: 8192, memoryAvailableMb: 3900, productionWorkers: null, stagingWorkers: null, processRssTotalMb: 500, productionRssMb: null, stagingRssMb: null, componentsJson: '[]', sourcesJson: '[]' }) }
  const { snapshot } = await createCapacityService({ repository }).current()
  assert.equal(snapshot.reconciliation.accountedRssMb, null)
  assert.equal(snapshot.reconciliation.unaccountedRssMb, null)
  assert.equal(snapshot.reconciliation.status, 'unknown')
  assert.equal(snapshot.environments[1].status, 'unknown')
  assert.equal(snapshot.stagingSuggestion, null)
})

test('historico de 30 dias usa rollup diario e declara cobertura da janela inteira', async () => {
  const until = new Date('2026-08-31T12:00:00Z')
  const points = Array.from({ length: 30 }, (_, index) => ({ bucketStart: new Date(Date.UTC(2026, 7, 2 + index)), metricsJson: '{}', sessionPeak: 10, workerPeak: 10, safeLimitMin: 22, worstState: 'healthy', sampleCount: 288, expectedSampleCount: 288 }))
  let query
  const repository = { ensureHostProfile: async () => ({ id: 'host' }), listRollups: async (_id, value) => (query = value, points), listEvents: async () => [] }
  const result = await createCapacityService({ repository, now: () => until }).history('30d')
  assert.equal(query.granularity, 'day')
  assert.equal(query.limit, 600)
  assert.equal(result.granularity, 'day')
  assert.deepEqual(result.coverage, { pointCount: 30, expectedPoints: 30, ratio: 1, firstPointAt: '2026-08-02T00:00:00.000Z', lastPointAt: '2026-08-31T00:00:00.000Z' })
})

test('decisão persistida expõe sempre o maior contador conhecido', async () => {
  const now = new Date('2026-08-27T12:00:00Z')
  for (const [connectedSessions, productionWorkers, expected] of [[16, 17, 17], [18, 17, 18]]) {
    const raw = { collectedAt: now, policyVersion: 'capacity-policy-v1', operationalState: 'attention', safeSessionLimit: 22, connectedSessions, productionWorkers, sourcesJson: '[]', componentsJson: '[]', decisionReasonsJson: '[]' }
    const repository = { ensureHostProfile: async () => ({ id: 'h', inventoryJson: '{}' }), latestSnapshot: async () => raw, listAlerts: async () => [], listRollups: async () => [], listSnapshots: async () => [] }
    const service = createCapacityService({ repository, now: () => now })
    assert.equal((await service.current()).snapshot.decision.sessions, expected)
    assert.equal((await service.scenario({ newCustomers: 1, horizonMonths: 1, activationPercent: 100, stagingExpectedOn: false })).projectedSessions, expected + 1)
  }
})
