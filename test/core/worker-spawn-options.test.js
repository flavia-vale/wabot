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

// --- Rodada 3 de RAM (2026-09-19): alocador, limiares do glibc e geração jovem
// Ver docs/analise-ram-rodada-3-2026-09-19.md. Tudo nasce desligado.

test('rodada 3: sem env, NADA muda (execArgv e ambiente iguais ao histórico)', () => {
  assert.deepEqual(resolveWorkerExecArgv({}), ['--max-old-space-size=384'])
  assert.deepEqual(resolveWorkerSpawnEnv({}), {})
})

test('WA_WORKER_LD_PRELOAD só aceita caminho absoluto de UM objeto — e nunca lê LD_PRELOAD cru', () => {
  const so = '/usr/lib/x86_64-linux-gnu/libjemalloc.so.2'
  assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_LD_PRELOAD: so }), { LD_PRELOAD: so })
  assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_LD_PRELOAD: ` ${so} ` }), { LD_PRELOAD: so })
  for (const ruim of ['libjemalloc.so.2', 'relativo/lib.so', `${so}:/outra.so`, '/com espaco/lib.so', '', '0']) {
    assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_LD_PRELOAD: ruim }), {}, JSON.stringify(ruim))
  }
  assert.deepEqual(resolveWorkerSpawnEnv({ LD_PRELOAD: so }), {}, 'a entrada é sempre WA_WORKER_*')
})

test('WA_WORKER_MALLOC_CONF aceita o formato chave:valor do jemalloc e recusa lixo', () => {
  const conf = 'background_thread:true,dirty_decay_ms:5000,muzzy_decay_ms:5000,narenas:2'
  assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_CONF: conf }), { MALLOC_CONF: conf })
  for (const ruim of ['', ' ', 'a b', 'x;rm -rf', 'chave="v"']) {
    assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_CONF: ruim }), {}, JSON.stringify(ruim))
  }
})

test('limiares do glibc viram as envs COM underscore final (é assim que o glibc as lê)', () => {
  assert.deepEqual(
    resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_MMAP_THRESHOLD: '65536', WA_WORKER_MALLOC_TRIM_THRESHOLD: '262144' }),
    { MALLOC_MMAP_THRESHOLD_: '65536', MALLOC_TRIM_THRESHOLD_: '262144' }
  )
  for (const ruim of ['0', '-1', 'abc', '']) {
    assert.deepEqual(resolveWorkerSpawnEnv({ WA_WORKER_MALLOC_MMAP_THRESHOLD: ruim }), {}, JSON.stringify(ruim))
  }
})

test('WA_WORKER_MAX_SEMI_SPACE_MB entra no execArgv; 0/lixo não passa flag', () => {
  assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_MAX_SEMI_SPACE_MB: '8' }), ['--max-old-space-size=384', '--max-semi-space-size=8'])
  for (const ruim of ['0', '-4', 'oito', '']) {
    assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_MAX_SEMI_SPACE_MB: ruim }), ['--max-old-space-size=384'], JSON.stringify(ruim))
  }
})

test('WA_WORKER_V8_OPTIMIZE_FOR_SIZE só liga com 1/true (não é aceita em NODE_OPTIONS, por isso mora aqui)', () => {
  assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_V8_OPTIMIZE_FOR_SIZE: '1' }), ['--max-old-space-size=384', '--optimize-for-size'])
  assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_V8_OPTIMIZE_FOR_SIZE: 'true' }), ['--max-old-space-size=384', '--optimize-for-size'])
  for (const off of ['0', 'false', '', 'sim', 'on']) {
    assert.deepEqual(resolveWorkerExecArgv({ WA_WORKER_V8_OPTIMIZE_FOR_SIZE: off }), ['--max-old-space-size=384'], JSON.stringify(off))
  }
})

test('as chaves da rodada 3 convivem com as da rodada 1 sem se sobrescrever', () => {
  const env = {
    WA_WORKER_MALLOC_ARENA_MAX: '2',
    WA_WORKER_LD_PRELOAD: '/usr/lib/x86_64-linux-gnu/libjemalloc.so.2',
    WA_WORKER_MALLOC_CONF: 'background_thread:true,narenas:2',
    WA_WORKER_MAX_SEMI_SPACE_MB: '8',
    WA_WORKER_V8_OPTIMIZE_FOR_SIZE: '1',
  }
  assert.deepEqual(resolveWorkerSpawnEnv(env), {
    MALLOC_ARENA_MAX: '2',
    LD_PRELOAD: '/usr/lib/x86_64-linux-gnu/libjemalloc.so.2',
    MALLOC_CONF: 'background_thread:true,narenas:2',
  })
  assert.deepEqual(resolveWorkerExecArgv(env), ['--max-old-space-size=384', '--max-semi-space-size=8', '--optimize-for-size'])
})
