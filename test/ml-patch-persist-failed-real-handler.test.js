import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  getOperationalSignalsSnapshot,
  __resetOperationalSignals,
} from '../src/observability/operationalSignals.js'
import { attachCredentialPatchHandler } from '../src/api/routes/linkConversion.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

beforeEach(() => __resetOperationalSignals())

// ---------------------------------------------------------------------------
// specs/006-ml-cookie-expiry-followup — T041 (Phase 7, corrige T040)
//
// T025/T026 (test/product-info-scraper.test.js) provam que
// productInfoScraper.js reage a uma falha de `__onCredentialPatch`, mas
// injetam um stub que SUBSTITUI o handler inteiro (`__onCredentialPatch:
// async () => { throw ... }`) — o que não é o comportamento de produção: o
// handler REAL (`attachCredentialPatchHandler` em linkConversion.js e o
// equivalente em bot-worker.js `loadConfig`) engole a exceção de
// `persistCredentialPatch` no seu PRÓPRIO catch, sem relançar. Antes de T040,
// esse catch real nunca emitia `recordOperationalSignal('ml_patch_persist_failed', ...)`
// — tornando o sinal durável inatingível em produção mesmo com T025/T026
// verdes.
//
// Este teste exercita o handler REAL: `persistCredentialPatchFn` é injetado
// (como uma falha simulada de SQLITE_BUSY, sem tocar banco/env real) no lugar
// do `persistCredentialPatch` de produção, e o teste confirma que é o CATCH
// de `attachCredentialPatchHandler` — não um stub de `__onCredentialPatch` —
// quem chama `recordOperationalSignal`. db-free/env-free (nenhuma env de
// banco setada; `persistCredentialPatchFn` é 100% injetado via opts).
// ---------------------------------------------------------------------------

test('attachCredentialPatchHandler (linkConversion.js): catch REAL de persistCredentialPatch emite recordOperationalSignal(ml_patch_persist_failed)', async () => {
  const credentialsMap = { mercadolivre: { ssid: 'ssid-antigo' } }
  const warnCalls = []
  const fakeLogger = { warn: (...args) => warnCalls.push(args) }

  const failingPersist = async () => {
    const err = new Error('SQLITE_BUSY: database is locked (simulado)')
    err.code = 'SQLITE_BUSY'
    throw err
  }

  attachCredentialPatchHandler(credentialsMap, 'user-real-handler-1', fakeLogger, failingPersist)

  // Chama o handler REAL exatamente como productInfoScraper.js chamaria.
  await credentialsMap.__onCredentialPatch('mercadolivre', { ssid: 'ssid-rotacionado' })

  assert.ok(warnCalls.length >= 1, 'logger.warn deveria ter sido chamado pelo catch real')
  assert.equal(warnCalls[0][0].platform, 'mercadolivre')

  const snap = getOperationalSignalsSnapshot()
  assert.equal(
    snap.ml_patch_persist_failed?.total,
    1,
    'recordOperationalSignal deveria ter sido chamado a partir do catch REAL de attachCredentialPatchHandler',
  )
})

test('attachCredentialPatchHandler (linkConversion.js): plataforma diferente de mercadolivre não emite o sinal ML', async () => {
  const credentialsMap = { amazon: { tag: 'x' } }
  const failingPersist = async () => { throw new Error('falha simulada') }

  attachCredentialPatchHandler(credentialsMap, 'user-real-handler-2', { warn: () => {} }, failingPersist)
  await credentialsMap.__onCredentialPatch('amazon', { tag: 'y' })

  const snap = getOperationalSignalsSnapshot()
  assert.equal(snap.ml_patch_persist_failed, undefined, 'sinal ML não deve disparar para outras plataformas')
})

test('attachCredentialPatchHandler (linkConversion.js): sucesso da persistência não emite o sinal', async () => {
  const credentialsMap = { mercadolivre: { ssid: 'ssid-antigo' } }
  const okPersist = async ({ patch }) => ({ ssid: patch.ssid })

  attachCredentialPatchHandler(credentialsMap, 'user-real-handler-3', { warn: () => {} }, okPersist)
  await credentialsMap.__onCredentialPatch('mercadolivre', { ssid: 'ssid-novo' })

  const snap = getOperationalSignalsSnapshot()
  assert.equal(snap.ml_patch_persist_failed, undefined)
  assert.equal(credentialsMap.mercadolivre.ssid, 'ssid-novo', 'patch aplicado localmente em caso de sucesso')
})

// ---------------------------------------------------------------------------
// bot-worker.js roda como processo próprio (fork de sessão WhatsApp) e não
// exporta `loadConfig`/o handler para import direto em teste (mesmo padrão de
// test/bot-worker-retry-cache-wiring.test.js) — por isso a verificação do
// caminho real ali é ESTRUTURAL: confirma que o mesmo padrão do fix de T040
// (recordOperationalSignal dentro do catch de persistCredentialPatch, com
// guarda de plataforma) está presente no source, e não só no scraper.
// ---------------------------------------------------------------------------

test('bot-worker.js loadConfig: catch REAL de persistCredentialPatch chama recordOperationalSignal (verificação estrutural)', () => {
  const source = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

  const handlerStart = source.indexOf("Object.defineProperty(credentials, '__onCredentialPatch'")
  assert.notEqual(handlerStart, -1, 'handler __onCredentialPatch não encontrado em bot-worker.js')

  const handlerEnd = source.indexOf('\n  })', handlerStart)
  const handlerBlock = source.slice(handlerStart, handlerEnd)

  assert.match(handlerBlock, /catch\s*\(err\)\s*\{/, 'bloco do handler precisa ter um catch')
  assert.match(
    handlerBlock,
    /recordOperationalSignal\(\s*'ml_patch_persist_failed'/,
    'catch real de persistCredentialPatch em bot-worker.js precisa emitir recordOperationalSignal',
  )
  assert.match(
    handlerBlock,
    /platform === 'mercadolivre'/,
    "emissão precisa ser restrita à plataforma 'mercadolivre' (evita ruído para outras plataformas)",
  )
})
