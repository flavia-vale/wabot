import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  OBSERVABILITY_WINDOWS,
  OPERATIONAL_LOG_ROW_LIMIT,
  buildOperationalWindows,
  classifyOperationalLogIntoCounts,
  emptyOperationalLogCounts,
  windowStart,
} from '../src/domain/admin/operationalLogs.js'

/*
 * Auditoria do admin (docs/admin/auditoria-painel-admin.md, Q2):
 * `/system/observability` (24 h) e `/logs/summary` (até 30 d) faziam
 * `messageLog.findMany` SEM `take` e traziam a tabela inteira para a memória
 * da API só para contar. Sucesso agora entra por `count` no banco; só as
 * linhas que precisam de `errorMsg` vêm, com teto.
 */

const AGORA = new Date('2026-10-02T12:00:00Z')
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('sucesso contado no banco substitui a contagem linha a linha', () => {
  const logs = [
    { status: 'error', errorMsg: 'timeout:send:x@g.us', sentAt: '2026-10-02T11:59:00Z' },
    { status: 'skipped', errorMsg: 'skip:dedup_recent_link', sentAt: '2026-10-02T11:30:00Z' },
    { status: 'queued', errorMsg: null, sentAt: '2026-10-02T11:58:00Z' },
  ]
  const windows = buildOperationalWindows(logs, AGORA, { successByWindow: { '5m': 7, '24h': 900 } })
  assert.equal(windows['5m'].logs.success, 7)
  assert.equal(windows['5m'].logs.timeoutTotal, 1)
  assert.equal(windows['5m'].logs.inFlight, 1)
  assert.equal(windows['5m'].logs.skippedDedup, 0, 'linha de 30 min atrás não entra na janela de 5 min')
  assert.equal(windows['1h'].logs.skippedDedup, 1)
  assert.equal(windows['1h'].logs.success, 0, 'janela sem contagem do banco fica em zero, nunca inventa')
  assert.equal(windows['24h'].logs.success, 900)
})

test('a janela nunca começa antes do período pedido (período de 30 min não vira 24 h)', () => {
  const from = new Date('2026-10-02T11:30:00Z')
  assert.equal(windowStart(AGORA, 24 * 3600_000, from).toISOString(), '2026-10-02T11:30:00.000Z')
  assert.equal(windowStart(AGORA, 5 * 60_000, from).toISOString(), '2026-10-02T11:55:00.000Z')
  const windows = buildOperationalWindows([{ status: 'error', errorMsg: 'x', sentAt: '2026-10-02T10:00:00Z' }], AGORA, { from })
  assert.equal(windows['24h'].logs.errorOther, 0)
  assert.equal(windows['24h'].from, '2026-10-02T11:30:00.000Z')
})

test('classificação continua a mesma de antes (dedup, config, timeout, outros, em voo)', () => {
  const counts = emptyOperationalLogCounts()
  for (const log of [
    { status: 'success' },
    { status: 'sending' },
    { status: 'skipped', errorMsg: 'skip:dedup_recent_link' },
    { status: 'skipped', errorMsg: 'skip:no_valid_conversions' },
    { status: 'error', errorMsg: 'timeout:send:a@g.us' },
    { status: 'error', errorMsg: 'error:baileys:500' },
  ]) classifyOperationalLogIntoCounts(counts, log)
  assert.equal(counts.success, 1)
  assert.equal(counts.inFlight, 1)
  assert.equal(counts.skippedDedup, 1)
  assert.equal(counts.skippedConfig, 1)
  assert.equal(counts.timeoutTotal, 1)
  assert.equal(counts.errorOther, 1)
  assert.deepEqual(OBSERVABILITY_WINDOWS.map(w => w.key), ['5m', '30m', '1h', '6h', '24h'])
  assert.equal(OPERATIONAL_LOG_ROW_LIMIT, 20_000)
})

test('admin.js: nenhum messageLog.findMany sem take', () => {
  const fonte = read('src/api/routes/admin.js')
  let pos = 0
  let ocorrencias = 0
  while ((pos = fonte.indexOf('db.messageLog.findMany(', pos)) >= 0) {
    ocorrencias++
    const trecho = fonte.slice(pos, pos + 600)
    assert.ok(/take:/.test(trecho), `messageLog.findMany sem take em:\n${trecho.slice(0, 200)}`)
    pos += 10
  }
  assert.ok(ocorrencias >= 3, 'esperava achar as leituras de messageLog')
})

test('as duas rotas usam a amostra operacional (sucesso por count, não-sucesso com teto)', () => {
  const fonte = read('src/api/routes/admin.js')
  const helper = fonte.slice(fonte.indexOf('async function loadOperationalLogSample'), fonte.indexOf('\n}\n', fonte.indexOf('async function loadOperationalLogSample')))
  assert.match(helper, /status: \{ not: 'success' \}/)
  assert.match(helper, /take: OPERATIONAL_LOG_ROW_LIMIT \+ 1/)
  assert.match(helper, /db\.messageLog\.count\(\{ where: \{ sentAt: range, status: 'success' \} \}\)/)
  for (const rota of ["app.get('/system/observability'", "app.get('/logs/summary'"]) {
    const inicio = fonte.indexOf(rota)
    const corpo = fonte.slice(inicio, fonte.indexOf('\n  })\n', inicio))
    assert.match(corpo, /loadOperationalLogSample\(/, `${rota} não usa a amostra`)
    assert.ok(!corpo.includes('db.messageLog.findMany'), `${rota} voltou a ler messageLog direto`)
  }
  const resumo = fonte.slice(fonte.indexOf("app.get('/logs/summary'"))
  assert.match(resumo, /dataCoverage: \{ rowLimit: OPERATIONAL_LOG_ROW_LIMIT, truncated: logSample\.truncated \}/)
})
