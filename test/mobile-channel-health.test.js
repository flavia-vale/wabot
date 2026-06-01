import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getHealthChipStyle } from '../dashboard/lib/mobileChannelHealth.js'

test('green retorna label saudável e tone success', () => {
  const result = getHealthChipStyle('green')
  assert.equal(result.label, 'saudável')
  assert.equal(result.tone, 'success')
})

test('yellow retorna label atenção e tone warn', () => {
  const result = getHealthChipStyle('yellow')
  assert.equal(result.label, 'atenção')
  assert.equal(result.tone, 'warn')
})

test('red retorna label risco e tone danger', () => {
  const result = getHealthChipStyle('red')
  assert.equal(result.label, 'risco')
  assert.equal(result.tone, 'danger')
})

test('critical retorna label risco e tone danger', () => {
  const result = getHealthChipStyle('critical')
  assert.equal(result.label, 'risco')
  assert.equal(result.tone, 'danger')
})

test('status desconhecido retorna label — e tone neutral', () => {
  const result = getHealthChipStyle('unknown-status')
  assert.equal(result.label, '—')
  assert.equal(result.tone, 'neutral')
})

test('undefined retorna label — e tone neutral', () => {
  const result = getHealthChipStyle(undefined)
  assert.equal(result.label, '—')
  assert.equal(result.tone, 'neutral')
})
