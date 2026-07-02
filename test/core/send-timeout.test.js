import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveSendTimeoutOverrideMs,
  resolveSendTimeoutMs,
  DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS,
} from '../../src/core/sendTimeout.js'

test('override: vazio/0/negativo/NaN → null (usa o array por tentativa)', () => {
  assert.equal(resolveSendTimeoutOverrideMs(undefined), null)
  assert.equal(resolveSendTimeoutOverrideMs(''), null)
  assert.equal(resolveSendTimeoutOverrideMs('0'), null)
  assert.equal(resolveSendTimeoutOverrideMs(0), null)
  assert.equal(resolveSendTimeoutOverrideMs(-5), null)
  assert.equal(resolveSendTimeoutOverrideMs('abc'), null)
})

test('override: > 0 vale, com clamp no piso de 5s', () => {
  assert.equal(resolveSendTimeoutOverrideMs('30000'), 30_000)
  assert.equal(resolveSendTimeoutOverrideMs(30_000), 30_000)
  assert.equal(resolveSendTimeoutOverrideMs('1000'), 5_000) // clamp
})

test('REGRESSÃO bug linha 729: sem env NÃO trava em 5s — usa o array [90,60,45]s', () => {
  const overrideMs = resolveSendTimeoutOverrideMs(process.env.SEND_MESSAGE_TIMEOUT_MS_UNSET)
  assert.equal(overrideMs, null)
  assert.equal(resolveSendTimeoutMs(1, { overrideMs }), 90_000)
  assert.equal(resolveSendTimeoutMs(2, { overrideMs }), 60_000)
  assert.equal(resolveSendTimeoutMs(3, { overrideMs }), 45_000)
})

test('array por tentativa: 1ª paciente, retries rápidas; satura no último', () => {
  assert.equal(resolveSendTimeoutMs(1), DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS[0])
  assert.equal(resolveSendTimeoutMs(2), DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS[1])
  assert.equal(resolveSendTimeoutMs(3), DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS[2])
  assert.equal(resolveSendTimeoutMs(9), DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS[2]) // clamp no último
  assert.equal(resolveSendTimeoutMs(0), DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS[0]) // defensivo
})

test('override uniforme sobrepõe o array em todas as tentativas', () => {
  const overrideMs = resolveSendTimeoutOverrideMs('30000')
  assert.equal(resolveSendTimeoutMs(1, { overrideMs }), 30_000)
  assert.equal(resolveSendTimeoutMs(2, { overrideMs }), 30_000)
  assert.equal(resolveSendTimeoutMs(3, { overrideMs }), 30_000)
})
