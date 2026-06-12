import test from 'node:test'
import assert from 'node:assert/strict'
import { createRestartBudget } from '../src/supervisor/restartBudget.js'

function clock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms) => { t += ms } }
}

test('permite restarts dentro do orçamento e quarentena ao estourar', () => {
  const c = clock()
  const budget = createRestartBudget({ windowMs: 15 * 60_000, maxRestarts: 3, quarantineMs: 30 * 60_000, now: c.now })

  for (let i = 1; i <= 3; i++) {
    const verdict = budget.registerRestart('u1')
    assert.equal(verdict.allowed, true, `restart ${i} dentro do orçamento`)
    c.advance(10_000)
  }
  const fourth = budget.registerRestart('u1')
  assert.equal(fourth.allowed, false)
  assert.equal(fourth.justQuarantined, true)
  assert.equal(budget.isQuarantined('u1'), true)
})

test('janela deslizante: restarts antigos saem do orçamento', () => {
  const c = clock()
  const budget = createRestartBudget({ windowMs: 60_000, maxRestarts: 2, quarantineMs: 60_000, now: c.now })

  budget.registerRestart('u1')
  budget.registerRestart('u1')
  c.advance(61_000) // os dois saem da janela
  const verdict = budget.registerRestart('u1')
  assert.equal(verdict.allowed, true)
  assert.equal(verdict.count, 1)
})

test('quarentena expira sozinha e zera o orçamento', () => {
  const c = clock()
  const budget = createRestartBudget({ windowMs: 60_000, maxRestarts: 1, quarantineMs: 30_000, now: c.now })

  budget.registerRestart('u1')
  assert.equal(budget.registerRestart('u1').quarantined, true)
  assert.equal(budget.isQuarantined('u1'), true)

  c.advance(30_001)
  assert.equal(budget.isQuarantined('u1'), false)
  assert.equal(budget.registerRestart('u1').allowed, true, 'orçamento renovado após quarentena')
})

test('registerRestart durante a quarentena não estende nem libera', () => {
  const c = clock()
  const budget = createRestartBudget({ windowMs: 60_000, maxRestarts: 1, quarantineMs: 30_000, now: c.now })

  budget.registerRestart('u1')
  budget.registerRestart('u1') // quarentena
  c.advance(10_000)
  const verdict = budget.registerRestart('u1')
  assert.equal(verdict.allowed, false)
  assert.equal(verdict.quarantined, true)
  assert.ok(verdict.remainingMs <= 20_000, 'remainingMs deve refletir o prazo original')
})

test('clear (start manual) sai da quarentena imediatamente', () => {
  const c = clock()
  const budget = createRestartBudget({ windowMs: 60_000, maxRestarts: 1, quarantineMs: 30 * 60_000, now: c.now })

  budget.registerRestart('u1')
  budget.registerRestart('u1')
  assert.equal(budget.isQuarantined('u1'), true)
  budget.clear('u1')
  assert.equal(budget.isQuarantined('u1'), false)
  assert.equal(budget.registerRestart('u1').allowed, true)
})

test('quarentena é por sessão — não vaza para outros tenants', () => {
  const c = clock()
  const budget = createRestartBudget({ windowMs: 60_000, maxRestarts: 1, quarantineMs: 30_000, now: c.now })

  budget.registerRestart('u1')
  budget.registerRestart('u1')
  assert.equal(budget.isQuarantined('u1'), true)
  assert.equal(budget.isQuarantined('u2'), false)
  assert.equal(budget.registerRestart('u2').allowed, true)
  assert.deepEqual(budget.listQuarantined().map((q) => q.userId), ['u1'])
})
