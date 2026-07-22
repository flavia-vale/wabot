import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  recordOperationalSignal,
  getOperationalSignalsSnapshot,
  __resetOperationalSignals,
} from '../src/observability/operationalSignals.js'

beforeEach(() => __resetOperationalSignals())

test('conta ocorrências por sinal e expõe total/last1h/last24h', () => {
  recordOperationalSignal('sqlite_busy', { model: 'MessageLog' })
  recordOperationalSignal('sqlite_busy', { model: 'AnalyticsEvent' })
  recordOperationalSignal('dedup_fail_open', { userId: 'u1' })

  const snap = getOperationalSignalsSnapshot()
  assert.equal(snap.sqlite_busy.total, 2)
  assert.equal(snap.sqlite_busy.last1h, 2)
  assert.equal(snap.sqlite_busy.last24h, 2)
  assert.equal(snap.dedup_fail_open.total, 1)
})

test('snapshot vazio quando nenhum sinal foi registrado', () => {
  assert.deepEqual(getOperationalSignalsSnapshot(), {})
})

test('janela 1h/24h: ocorrências antigas saem das janelas mas total persiste', () => {
  const now = Date.now()
  // injeta 3 eventos: 1 agora, 1 há 2h, 1 há 30h — manipulando o relógio via Date.now
  const realNow = Date.now
  try {
    Date.now = () => now - 30 * 60 * 60 * 1000 // 30h atrás
    recordOperationalSignal('sqlite_busy')
    Date.now = () => now - 2 * 60 * 60 * 1000 // 2h atrás
    recordOperationalSignal('sqlite_busy')
    Date.now = () => now // agora
    recordOperationalSignal('sqlite_busy')
  } finally {
    Date.now = realNow
  }

  const snap = getOperationalSignalsSnapshot(now)
  assert.equal(snap.sqlite_busy.total, 3, 'total cumulativo nunca decai')
  assert.equal(snap.sqlite_busy.last24h, 2, 'o de 30h saiu da janela de 24h')
  assert.equal(snap.sqlite_busy.last1h, 1, 'só o "agora" está dentro de 1h')
})

test('recordOperationalSignal retorna o total acumulado e não lança', () => {
  assert.equal(recordOperationalSignal('dedup_fail_open'), 1)
  assert.equal(recordOperationalSignal('dedup_fail_open'), 2)
})

test('sinal wa_forbidden é contabilizado por chip (vigilância de 403/ban)', () => {
  assert.equal(recordOperationalSignal('wa_forbidden', { userId: 'u1', code: 403 }), 1)
  recordOperationalSignal('wa_forbidden', { userId: 'u1', code: 403 })
  const snap = getOperationalSignalsSnapshot()
  assert.equal(snap.wa_forbidden.total, 2)
  assert.equal(snap.wa_forbidden.last1h, 2)
})

// ---------------------------------------------------------------------------
// specs/006-ml-cookie-expiry-followup — US3/T024: ml_patch_persist_failed
// (falha ao persistir rotação de credencial ML, cookie ou OAuth) incrementa
// o contador in-memory e roteia para o evento durável ops_ml_patch_persist_failed.
// ---------------------------------------------------------------------------

test('ml_patch_persist_failed (axis:cookie) incrementa o contador in-memory do sinal', () => {
  assert.equal(recordOperationalSignal('ml_patch_persist_failed', { axis: 'cookie' }), 1)
  recordOperationalSignal('ml_patch_persist_failed', { axis: 'cookie' })
  const snap = getOperationalSignalsSnapshot()
  assert.equal(snap.ml_patch_persist_failed.total, 2)
  assert.equal(snap.ml_patch_persist_failed.last1h, 2)
})

test('ml_patch_persist_failed (axis:oauth) incrementa o mesmo sinal (contador único, metadata distingue o eixo)', () => {
  assert.equal(recordOperationalSignal('ml_patch_persist_failed', { axis: 'oauth' }), 1)
  const snap = getOperationalSignalsSnapshot()
  assert.equal(snap.ml_patch_persist_failed.total, 1)
})

test('ml_patch_persist_failed não lança mesmo se a persistência durável (dynamic import de analytics.js) falhar internamente', async () => {
  // recordOperationalSignal nunca deve lançar — best-effort tanto na falha de
  // persistência de credencial (chamador) quanto na própria emissão do sinal.
  assert.doesNotThrow(() => recordOperationalSignal('ml_patch_persist_failed', { axis: 'cookie' }))
  // dá tempo pro fire-and-forget do emitDurable (dynamic import + trackAnalyticsEventSafe)
  // resolver sem que uma rejeição não tratada vaze para o processo de teste.
  await new Promise(resolve => setTimeout(resolve, 20))
})

// Teste estrutural (mesmo padrão de test/bot-worker-retry-cache-wiring.test.js):
// roteamento de ml_patch_persist_failed -> ops_ml_patch_persist_failed é lido
// diretamente do source do módulo, sem precisar mockar o dynamic import de
// analytics.js (não há flag --experimental-test-module-mocks no test runner
// deste repo) — confirma que o mapa ANALYTICS_EVENT_BY_SIGNAL contém a
// entrada esperada, e que analytics.js tem o evento na allowlist.
test('ml_patch_persist_failed roteia para o evento durável ops_ml_patch_persist_failed (allowlist + mapa)', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const __dirname = dirname(fileURLToPath(import.meta.url))

  const signalsSource = readFileSync(join(__dirname, '../src/observability/operationalSignals.js'), 'utf8')
  assert.match(
    signalsSource,
    /ml_patch_persist_failed:\s*'ops_ml_patch_persist_failed'/,
    'ANALYTICS_EVENT_BY_SIGNAL precisa mapear ml_patch_persist_failed -> ops_ml_patch_persist_failed',
  )

  const analyticsSource = readFileSync(join(__dirname, '../src/analytics.js'), 'utf8')
  assert.match(
    analyticsSource,
    /'ops_ml_patch_persist_failed'/,
    'ops_ml_patch_persist_failed precisa estar na allowlist ANALYTICS_EVENTS de src/analytics.js',
  )
})
