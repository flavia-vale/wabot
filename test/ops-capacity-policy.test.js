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
