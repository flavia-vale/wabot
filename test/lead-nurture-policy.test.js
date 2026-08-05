import test from 'node:test'
import assert from 'node:assert/strict'
import { isRealEmail, isWithinActiveWindow, elapsedDays, computeDueSteps } from '../src/leadNurture/policy.js'

test('isRealEmail aceita e-mail real', () => {
  assert.equal(isRealEmail('flavia.vale@usp.br'), true)
})

test('isRealEmail rejeita fallback @sistema.com', () => {
  assert.equal(isRealEmail('user_ab12cd@sistema.com'), false)
})

test('isRealEmail rejeita formato inválido', () => {
  assert.equal(isRealEmail('nao-e-email'), false)
  assert.equal(isRealEmail(''), false)
  assert.equal(isRealEmail(null), false)
  assert.equal(isRealEmail(undefined), false)
})

test('elapsedDays calcula dias inteiros decorridos (floor)', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  assert.equal(elapsedDays(createdAt, new Date('2026-07-01T00:00:00Z')), 0)
  assert.equal(elapsedDays(createdAt, new Date('2026-07-03T00:00:00Z')), 2)
  assert.equal(elapsedDays(createdAt, new Date('2026-07-03T23:59:00Z')), 2)
  assert.equal(elapsedDays(createdAt, new Date('2026-07-08T00:00:00Z')), 7)
})

test('elapsedDays nunca é negativo (now anterior a createdAt)', () => {
  const createdAt = new Date('2026-07-05T00:00:00Z')
  assert.equal(elapsedDays(createdAt, new Date('2026-07-01T00:00:00Z')), 0)
})

test('isWithinActiveWindow true dentro da janela padrão de 8 dias', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  assert.equal(isWithinActiveWindow(createdAt, new Date('2026-07-08T00:00:00Z')), true)
  assert.equal(isWithinActiveWindow(createdAt, new Date('2026-07-10T00:00:00Z')), false)
})

test('computeDueSteps: elapsedDays=0 não deve nenhum passo (0 é coberto pelo welcome)', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-01T00:00:00Z')
  assert.deepEqual(computeDueSteps({ createdAt, now, sentSteps: [], isUnsubscribed: false }), [])
})

test('computeDueSteps: elapsedDays=2 deve o passo 2', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-03T00:00:00Z')
  assert.deepEqual(computeDueSteps({ createdAt, now, sentSteps: [], isUnsubscribed: false }), [2])
})

test('computeDueSteps: elapsedDays=5 sem passo 2 enviado deve [2,5] juntos', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-06T00:00:00Z')
  assert.deepEqual(computeDueSteps({ createdAt, now, sentSteps: [], isUnsubscribed: false }), [2, 5])
})

test('computeDueSteps: elapsedDays=7 com sentSteps={2,5} deve só o passo 7', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  assert.deepEqual(computeDueSteps({ createdAt, now, sentSteps: [2, 5], isUnsubscribed: false }), [7])
})

test('computeDueSteps: passo já enviado não é reenviado', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  assert.deepEqual(computeDueSteps({ createdAt, now, sentSteps: [2, 5, 7], isUnsubscribed: false }), [])
})

test('computeDueSteps: isUnsubscribed=true nunca retorna passo, mesmo elapsedDays alto', () => {
  const createdAt = new Date('2026-07-01T00:00:00Z')
  const now = new Date('2026-07-08T00:00:00Z')
  assert.deepEqual(computeDueSteps({ createdAt, now, sentSteps: [], isUnsubscribed: true }), [])
})
