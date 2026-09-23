import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCapacity, evaluateResourceHealth } from '../src/ops/capacity/policy.js'

test('capacity-policy-v1 usa reserva e custo conservadores', () => {
  const decision = evaluateCapacity({ memoryTotalMb: 8192, fixedBaseP95Mb: 1200, workerRssP95Mb: 235, workerHistoryDays: 30, connectedSessions: 17 })
  assert.equal(decision.reserveMb, 1639)
  assert.equal(decision.sessionCostMb, 350)
  assert.equal(decision.safeLimit, 18)
  assert.equal(decision.headroomSessions, 1)
  assert.equal(decision.policyVersion, 'capacity-policy-v1')
})

test('p95 confiavel substitui piso de 350 MB e limite arredonda para baixo', () => {
  const decision = evaluateCapacity({ memoryTotalMb: 8192, fixedBaseP95Mb: 1536, workerRssP95Mb: 420, workerHistoryDays: 14, connectedSessions: 10 })
  assert.equal(decision.sessionCostMb, 420)
  assert.equal(decision.safeLimit, 15)
})

test('contador conservador escolhe o maior entre sessoes e workers', () => {
  const decision = evaluateCapacity({ memoryTotalMb: 8192, connectedSessions: 16, productionWorkers: 17 })
  assert.equal(decision.sessions, 17)
  assert.ok(decision.reasons.some((reason) => reason.code === 'SESSION_WORKER_DIVERGENCE'))
})

test('dados essenciais ausentes nunca produzem estado saudavel', () => {
  const decision = evaluateCapacity({ connectedSessions: 17 })
  assert.equal(decision.state, 'insufficient_data')
  assert.equal(decision.safeLimit, null)
})

test('swap ocupado sem atividade permanece informativo e pressao sustentada e critica', () => {
  assert.equal(evaluateResourceHealth({ memoryTotalMb: 8192, memoryAvailableMb: 4096, swapUsedMb: 800, swapInKbPerSec: 0, swapOutKbPerSec: 0 }).resources.swap.state, 'healthy')
  assert.equal(evaluateResourceHealth({ memoryTotalMb: 8192, memoryAvailableMb: 700, swapInKbPerSec: 12, swapOutKbPerSec: 8 }).resources.swap.state, 'critical')
})

test('thresholds e precedencia escolhem gargalo critico antes de atencao', () => {
  const health = evaluateResourceHealth({ memoryTotalMb: 8192, memoryAvailableMb: 4096, cpuPercent: 75, diskUsedPercent: 91, inodeUsedPercent: 80 })
  assert.equal(health.resources.cpu.state, 'attention')
  assert.equal(health.resources.disk.state, 'critical')
  assert.equal(health.resources.inodes.state, 'attention')
  assert.equal(health.bottleneck, 'disk')
})

import { resolveSessionCostFloorMb, resolveWorkerHistorySince, capacityPolicyOptionsFromEnv, DEFAULT_SESSION_COST_FLOOR_MB } from '../src/ops/capacity/policy.js'

test('piso por robô configurável: sem env continua 350', () => {
  assert.equal(DEFAULT_SESSION_COST_FLOOR_MB, 350)
  assert.equal(resolveSessionCostFloorMb(undefined), 350)
  assert.equal(resolveSessionCostFloorMb(''), 350)
  assert.equal(resolveSessionCostFloorMb('abc'), 350)
  assert.equal(resolveSessionCostFloorMb('-5'), 350)
  assert.equal(resolveSessionCostFloorMb('250'), 250)
  assert.equal(resolveSessionCostFloorMb('50'), 150)
  assert.equal(resolveSessionCostFloorMb('5000'), 1000)
})

test('produção medida (31.337 MB, p95 198 MB, piso 250) cabe ~100 robôs', () => {
  const decision = evaluateCapacity({ memoryTotalMb: 31337, connectedSessions: 54, workerRssP95Mb: 198, workerHistoryDays: 1, sessionCostFloorMb: 250 })
  assert.equal(decision.sessionCostMb, 250)
  assert.equal(decision.sessionCostFloorMb, 250)
  assert.equal(decision.safeLimit, 100)
  assert.ok(decision.reasons.some((r) => r.message.includes('250 MB')))
})

test('p95 medido acima do piso continua mandando (piso nunca esconde robô pesado)', () => {
  const decision = evaluateCapacity({ memoryTotalMb: 31337, connectedSessions: 54, workerRssP95Mb: 320, workerHistoryDays: 20, sessionCostFloorMb: 250 })
  assert.equal(decision.sessionCostMb, 320)
})

test('corte do histórico: data inválida vira sem corte', () => {
  assert.equal(resolveWorkerHistorySince(''), null)
  assert.equal(resolveWorkerHistorySince('ontem'), null)
  assert.equal(resolveWorkerHistorySince('2026-09-23T00:00:00Z').toISOString(), '2026-09-23T00:00:00.000Z')
  assert.deepEqual(capacityPolicyOptionsFromEnv({}), { sessionCostFloorMb: 350, workerHistorySince: null })
})

import { createCapacityRepository } from '../src/ops/capacity/repository.js'

test('histórico por robô respeita o corte e ignora o regime antigo', async () => {
  let where
  const db = { capacitySnapshot: { findMany: async (args) => { where = args.where; return [] } } }
  const repo = createCapacityRepository(db, { now: () => new Date('2026-09-23T12:00:00Z') })
  await repo.workerHistorySummary('h', { since: new Date('2026-09-22T23:00:00Z') })
  assert.equal(where.collectedAt.gte.toISOString(), '2026-09-22T23:00:00.000Z')
  await repo.workerHistorySummary('h', { since: new Date('2020-01-01T00:00:00Z') })
  assert.equal(where.collectedAt.gte.toISOString(), '2026-06-25T12:00:00.000Z')
  await repo.workerHistorySummary('h')
  assert.equal(where.collectedAt.gte.toISOString(), '2026-06-25T12:00:00.000Z')
})
