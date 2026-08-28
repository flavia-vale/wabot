import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCapacityScenario, validateCapacityScenarioInput } from '../src/ops/capacity/scenario.js'

test('valida limites e rejeita campos operacionais ou desconhecidos', () => {
  assert.deepEqual(validateCapacityScenarioInput({ newCustomers: 0, horizonMonths: 1, activationPercent: 0 }), { newCustomers: 0, horizonMonths: 1, activationPercent: 0, stagingExpectedOn: false })
  assert.throws(() => validateCapacityScenarioInput({ newCustomers: 10001, horizonMonths: 1, activationPercent: 50 }), /novos clientes/i)
  assert.throws(() => validateCapacityScenarioInput({ newCustomers: 1, horizonMonths: 0, activationPercent: 50 }), /horizonte/i)
  assert.throws(() => validateCapacityScenarioInput({ newCustomers: 1, horizonMonths: 1, activationPercent: 101 }), /ativação/i)
  assert.throws(() => validateCapacityScenarioInput({ newCustomers: 1.5, horizonMonths: 1, activationPercent: 50 }), /inteiro/i)
  assert.throws(() => validateCapacityScenarioInput({ newCustomers: 1, horizonMonths: 1, activationPercent: 50, command: 'pm2 restart' }), /não reconhecido/i)
})

test('arredonda sessões conservadoramente e calcula margem sem persistência', () => {
  const result = calculateCapacityScenario({ newCustomers: 10, horizonMonths: 3, activationPercent: 90, stagingExpectedOn: false }, { currentSessions: 17, safeLimit: 22, sessionCostMb: 350, calculatedAt: new Date('2026-08-27T00:00:00Z') })
  assert.equal(result.activatedSessions, 9)
  assert.equal(result.projectedSessions, 26)
  assert.equal(result.headroomSessions, -4)
  assert.equal(result.deficitSessions, 4)
  assert.equal(result.incrementalMemoryMb, 3150)
  assert.equal(result.bottleneck, 'memory')
  assert.equal(result.recommendedBy, '2026-08-27T00:00:00.000Z')
})

test('staging esperado reduz a margem de forma explícita', () => {
  const result = calculateCapacityScenario({ newCustomers: 0, horizonMonths: 36, activationPercent: 100, stagingExpectedOn: true }, { currentSessions: 4, safeLimit: 10, sessionCostMb: 350, stagingCurrentlyOn: false, stagingMemoryMb: 700 })
  assert.equal(result.effectiveSafeLimit, 8)
  assert.equal(result.headroomSessions, 4)
  assert.match(result.assumptions.join(' '), /staging/i)
})
