import test from 'node:test'
import assert from 'node:assert/strict'
import { isRecoverableWorkerError, installWorkerCrashGuards } from '../src/core/workerCrashGuard.js'

test('isRecoverableWorkerError: Boom de conexão é recuperável', () => {
  const boom = { isBoom: true, output: { statusCode: 428 }, message: 'Connection Closed' }
  assert.equal(isRecoverableWorkerError(boom), true)
})

test('isRecoverableWorkerError: erro com statusCode mas sem flag isBoom também conta', () => {
  assert.equal(isRecoverableWorkerError({ output: { statusCode: 408 }, message: 'Timed Out' }), true)
})

test('isRecoverableWorkerError: mensagens conhecidas de socket fechado', () => {
  assert.equal(isRecoverableWorkerError(new Error('Connection Closed')), true)
  assert.equal(isRecoverableWorkerError(new Error('Stream Errored (conflict)')), true)
  assert.equal(isRecoverableWorkerError(new Error('WebSocket was closed')), true)
})

test('isRecoverableWorkerError: erro de programação NÃO é recuperável', () => {
  assert.equal(isRecoverableWorkerError(new TypeError("Cannot read properties of undefined (reading 'foo')")), false)
  assert.equal(isRecoverableWorkerError(null), false)
  assert.equal(isRecoverableWorkerError(undefined), false)
})

test('installWorkerCrashGuards: erro recuperável loga warn e NÃO chama onFatal', () => {
  const calls = { warn: 0, error: 0, fatal: 0 }
  const logger = { warn: () => { calls.warn++ }, error: () => { calls.error++ } }
  const before = process.listeners('uncaughtException').slice()
  installWorkerCrashGuards({ logger, onFatal: () => { calls.fatal++ } })
  const handler = process.listeners('uncaughtException').find((fn) => !before.includes(fn))
  assert.ok(handler, 'handler de uncaughtException foi registrado')

  handler({ isBoom: true, output: { statusCode: 428 }, message: 'Connection Closed' })
  assert.equal(calls.warn, 1)
  assert.equal(calls.fatal, 0)
  assert.equal(calls.error, 0)

  handler(new TypeError('boom de verdade'))
  assert.equal(calls.error, 1)
  assert.equal(calls.fatal, 1)

  // limpeza: remove os handlers que registramos para não vazar entre testes
  process.removeListener('uncaughtException', handler)
  const rejHandlers = process.listeners('unhandledRejection').filter((fn) => !before.includes(fn))
  for (const fn of rejHandlers) process.removeListener('unhandledRejection', fn)
})
