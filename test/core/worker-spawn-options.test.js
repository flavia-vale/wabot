import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveWorkerExecArgv, resolveWorkerSpawnEnv, WORKER_DEFAULT_MAX_OLD_SPACE_MB } from '../../src/core/workerSpawnOptions.js'

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

// --- Ambiente do worker: alocador e pools de thread (2026-09-17) -------------
// Contexto medido em produção: 58% do PSS da frota está em arena do glibc, e
// todos os 41 robôs têm exatamente 29 threads (16 do motor do Prisma). Ver
// docs/analise-ram-memoria-nativa-2026-09-16.md.

test('sem env nenhuma o ambiente extra é VAZIO — fork byte a byte como sempre', () => {
  // Esta é a invariante mais importante do módulo: nada muda em produção até
  // alguém escrever uma env de propósito.
  assert.deepEqual(resolveWorkerSpawnEnv({}), {})
})

test('WA_WORKER_MALLOC_ARENA_MAX vira MALLOC_ARENA_MAX', () => {
  assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_ARENA_MAX: '2' }), { MALLOC_ARENA_MAX: '2' })
})

test('0 e valor inválido NÃO setam MALLOC_ARENA_MAX', () => {
  // Para o glibc, MALLOC_ARENA_MAX=0 significa "automático", não "desligado":
  // um 0 escrito com intenção de desligar ligaria o padrão. Aqui 0 e lixo
  // significam a mesma coisa segura — não setar nada.
  for (const valor of ['0', '-1', '', '  ', 'dois', 'true']) {
    assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_ARENA_MAX: valor }), {}, `valor: ${JSON.stringify(valor)}`)
  }
})

test('threads do Prisma e do libuv têm interruptores próprios e independentes', () => {
  assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_TOKIO_THREADS: '4' }), { TOKIO_WORKER_THREADS: '4' })
  assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_UV_THREADPOOL_SIZE: '2' }), { UV_THREADPOOL_SIZE: '2' })
  assert.deepEqual(
    resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_ARENA_MAX: '2', WA_WORKER_TOKIO_THREADS: '4', WA_WORKER_UV_THREADPOOL_SIZE: '2' }),
    { MALLOC_ARENA_MAX: '2', TOKIO_WORKER_THREADS: '4', UV_THREADPOOL_SIZE: '2' }
  )
})

test('não usa os nomes que as bibliotecas leem como ENTRADA', () => {
  // Pôr MALLOC_ARENA_MAX direto no .env valeria também para a API e para o
  // supervisor, que não são o alvo. A entrada é sempre WA_WORKER_*.
  assert.deepEqual(resolveWorkerSpawnEnv({ MALLOC_ARENA_MAX: '2', TOKIO_WORKER_THREADS: '4', UV_THREADPOOL_SIZE: '2' }), {})
})

test('WA_WORKER_V8_POOL_SIZE entra no execArgv, junto do teto de heap', () => {
  assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_V8_POOL_SIZE: '2' }), ['--max-old-space-size=384', '--v8-pool-size=2'])
  assert.deepEqual(resolveWorkerExecArgv({ BOT_WORKER_MAX_OLD_SPACE_MB: '0', WA_WORKER_V8_POOL_SIZE: '2' }), ['--v8-pool-size=2'])
})

test('execArgv sem a env nova continua idêntico ao histórico', () => {
  assert.deepEqual(resolveWorkerExecArgv({}), ['--max-old-space-size=384'])
  for (const valor of ['0', '', 'x']) {
    assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_V8_POOL_SIZE: valor }), ['--max-old-space-size=384'])
  }
})

test('o fork do sessionCore aplica os dois — guarda estrutural', () => {
  // Sem isto, o modulo puro fica correto e dormente: foi assim que o
  // auto-restart do supervisor passou meses "implementado" sem valer (RCA
  // 2026-08-31).
  const fonte = readFileSync(new URL('../../src/core/sessionCore.js', import.meta.url), 'utf8')
  assert.match(fonte, /resolveWorkerSpawnEnv\(process\.env\)/, 'fork precisa espalhar resolveWorkerSpawnEnv')
  assert.match(fonte, /execArgv: resolveWorkerExecArgv\(process\.env\)/, 'fork precisa manter resolveWorkerExecArgv')
})
