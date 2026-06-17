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
