import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveWorkerExecArgv, WORKER_DEFAULT_MAX_OLD_SPACE_MB } from '../../src/core/workerSpawnOptions.js'

test('sem env → aplica o default de heap', () => {
  assert.deepEqual(
    resolveWorkerExecArgv({}),
    [`--max-old-space-size=${WORKER_DEFAULT_MAX_OLD_SPACE_MB}`]
  )
})

test('valor inteiro positivo → usa o valor informado', () => {
  assert.deepEqual(
    resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: '256' }),
    ['--max-old-space-size=256']
  )
})

test('espaços ao redor são tolerados', () => {
  assert.deepEqual(
    resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: '  512 ' }),
    ['--max-old-space-size=512']
  )
})

test('"0" desliga o cap (escape hatch)', () => {
  assert.deepEqual(resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: '0' }), [])
})

test('string vazia desliga o cap', () => {
  assert.deepEqual(resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: '' }), [])
})

test('valor inválido/negativo desliga o cap (não quebra o fork)', () => {
  assert.deepEqual(resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: 'abc' }), [])
  assert.deepEqual(resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: '-100' }), [])
})
