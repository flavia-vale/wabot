import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldWarnModeRegression } from '../src/ops/modeRegressionGuard.js'

test('avisa em produção, modo inline, sessão conectada', () => {
  assert.equal(
    shouldWarnModeRegression({ appEnv: 'production', supervisorMode: 'inline', hasConnectedSession: true }),
    true,
  )
})

test('avisa em produção, modo vazio/indefinido, sessão conectada', () => {
  assert.equal(
    shouldWarnModeRegression({ appEnv: 'production', supervisorMode: undefined, hasConnectedSession: true }),
    true,
  )
})

test('não avisa em produção, modo remote, mesmo com sessão conectada', () => {
  assert.equal(
    shouldWarnModeRegression({ appEnv: 'production', supervisorMode: 'remote', hasConnectedSession: true }),
    false,
  )
})

test('não avisa em produção, modo inline, sem sessão conectada', () => {
  assert.equal(
    shouldWarnModeRegression({ appEnv: 'production', supervisorMode: 'inline', hasConnectedSession: false }),
    false,
  )
})

test('não avisa em staging, modo inline, sessão conectada (staging é canônico inline)', () => {
  assert.equal(
    shouldWarnModeRegression({ appEnv: 'staging', supervisorMode: 'inline', hasConnectedSession: true }),
    false,
  )
})

test('não avisa em dev/test sem APP_ENV', () => {
  assert.equal(
    shouldWarnModeRegression({ appEnv: undefined, supervisorMode: 'inline', hasConnectedSession: true }),
    false,
  )
})
