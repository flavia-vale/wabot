import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// MN-11 (segunda opinião, risco K10): "o freio de envio por processo dobraria
// com dois servidores". Lido o código, a premissa não vale: o freio por destino
// já mora no Redis, com chave por CONTA + DESTINO, e uma conta roda em um nó só.
// Este teste TRAVA esse fato — se alguém trocar a chave por algo por-processo
// ou por-nó, o freio passa a poder dobrar e o teste falha.

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('MN-11: chave do freio por destino é por conta+destino no Redis (não por nó nem por processo)', () => {
  const trecho = worker.slice(worker.indexOf('async function globalRateLimitWait'), worker.indexOf('GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS'))
  assert.match(trecho, /const key = `send:last:\$\{userId\}:\$\{destJid\}`/)
  assert.doesNotMatch(trecho, /nodeId|NODE_ID|process\.pid|hostname/i)
})

test('MN-11: o freio global usa o Redis do .env compartilhado (REDIS_URL), não um estado local', () => {
  assert.match(worker, /new Redis\(process\.env\.REDIS_URL, buildRedisOptions\('bot-worker-runtime'/)
})

test('MN-11: nenhum limitador de envio no supervisor/sessionCore é global entre contas (cada conta tem a própria fila)', () => {
  for (const f of ['../src/supervisor/index.js', '../src/core/sessionCore.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8')
    assert.doesNotMatch(src, /createSemaphore|globalSendLimit|sendBucket/i, f)
  }
})
