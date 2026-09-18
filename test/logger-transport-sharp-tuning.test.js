import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveLogTransportMode, LOG_TRANSPORT_MODES } from '../src/core/loggerTransport.js'
import { resolveSharpTuning, applySharpTuning } from '../src/core/sharpTuning.js'

// --- Logger: com ou sem worker thread ---------------------------------------

test('sem env → modo histórico (worker/thread-stream)', () => {
  assert.equal(resolveLogTransportMode({}), LOG_TRANSPORT_MODES.WORKER)
})

test('"inline" liga o multistream no próprio processo', () => {
  assert.equal(resolveLogTransportMode({ LOG_TRANSPORT_MODE: 'inline' }), LOG_TRANSPORT_MODES.INLINE)
  assert.equal(resolveLogTransportMode({ LOG_TRANSPORT_MODE: '  INLINE ' }), LOG_TRANSPORT_MODES.INLINE)
})

test('valor desconhecido cai no histórico — .env mal preenchido não muda o jeito de logar', () => {
  for (const raw of ['', '1', 'true', 'off', 'multistream', 'sim']) {
    assert.equal(resolveLogTransportMode({ LOG_TRANSPORT_MODE: raw }), LOG_TRANSPORT_MODES.WORKER, raw)
  }
})

test('o logger consome a decisão — guarda estrutural', () => {
  // Módulo puro correto e dormente é o modo de falha do RCA 2026-08-31.
  const fonte = readFileSync(new URL('../src/logger.js', import.meta.url), 'utf8')
  assert.match(fonte, /resolveLogTransportMode/)
  assert.match(fonte, /pino\.multistream/)
})

test('o modo inline NÃO pode deixar de escrever em nenhum dos dois destinos', () => {
  const fonte = readFileSync(new URL('../src/logger.js', import.meta.url), 'utf8')
  const inline = fonte.slice(fonte.indexOf('pino.multistream'), fonte.indexOf('logger.info'))
  assert.match(inline, /logFile/, 'o bot.log é o arquivo que todos os RCAs leem')
  assert.match(inline, /process\.stdout/, 'o PM2 captura o stdout')
})

// --- Sharp: cache e concorrência do libvips ---------------------------------

test('sem env → não mexe no Sharp (padrões da biblioteca)', () => {
  assert.deepEqual(resolveSharpTuning({}), {})
  const chamadas = []
  const fake = { cache: (v) => chamadas.push(['cache', v]), concurrency: (v) => chamadas.push(['concurrency', v]) }
  const r = applySharpTuning(fake, {})
  assert.equal(r.skipped, true)
  assert.deepEqual(chamadas, [], 'ausência da env significa NÃO chamar nada')
})

test('SHARP_CACHE_MB=0 é valor válido e desliga o cache de verdade', () => {
  assert.deepEqual(resolveSharpTuning({ SHARP_CACHE_MB: '0' }), { cacheMemoryMb: 0 })
  const chamadas = []
  const fake = { cache: (v) => chamadas.push(v), concurrency: () => {} }
  const r = applySharpTuning(fake, { SHARP_CACHE_MB: '0' })
  assert.deepEqual(chamadas, [{ memory: 0, files: 0, items: 0 }])
  assert.deepEqual(r.applied, { cacheMemoryMb: 0 })
})

test('valor positivo limita cache e concorrência', () => {
  const chamadas = []
  const fake = {
    cache: (v) => chamadas.push(['cache', v]),
    concurrency: (v) => chamadas.push(['concurrency', v]),
  }
  const r = applySharpTuning(fake, { SHARP_CACHE_MB: '8', SHARP_CONCURRENCY: '2' })
  assert.deepEqual(chamadas, [['cache', { memory: 8, files: 20, items: 100 }], ['concurrency', 2]])
  assert.deepEqual(r.applied, { cacheMemoryMb: 8, concurrency: 2 })
  assert.equal(r.error, undefined)
})

test('valor inválido/negativo é ignorado (não quebra o boot do worker)', () => {
  assert.deepEqual(resolveSharpTuning({ SHARP_CACHE_MB: 'abc', SHARP_CONCURRENCY: '-1' }), {})
  assert.deepEqual(resolveSharpTuning({ SHARP_CACHE_MB: '   ' }), {})
})

test('falha do Sharp NUNCA derruba o robô — best-effort', () => {
  const fake = { cache: () => { throw new Error('libvips recusou') }, concurrency: () => {} }
  const r = applySharpTuning(fake, { SHARP_CACHE_MB: '8' })
  assert.match(r.error, /libvips recusou/)
  assert.deepEqual(r.applied, {})
})

test('sharp ausente não explode', () => {
  assert.equal(applySharpTuning(null, { SHARP_CACHE_MB: '8' }).skipped, true)
})

test('o bot-worker aplica o ajuste — guarda estrutural', () => {
  const fonte = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(fonte, /applySharpTuning\(sharp, process\.env\)/)
  // ⚠️ TDZ: a chamada cita só imports. Uma constante de escopo de módulo acima
  // dela mataria TODO worker no boot (mesma lição do log de filtros de recepção).
  const linhas = fonte.split('\n')
  const alvo = linhas.findIndex((l) => l.includes('applySharpTuning(sharp, process.env)'))
  const constAntes = linhas.slice(0, alvo).some((l) => /^const\s+\w+\s*=/.test(l))
  assert.equal(constAntes, false, 'a chamada precisa vir antes de qualquer const de escopo de módulo')
})
