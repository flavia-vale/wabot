import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildErrorsByMessage } from '../src/adminLogSummary.js'

const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')

function trecho(inicio, fim) {
  const a = fonte.indexOf(inicio)
  assert.ok(a >= 0, `não achei ${inicio}`)
  return fonte.slice(a, fonte.indexOf(fim, a))
}

test('logs/summary agrupa no banco em vez de ler o MessageLog inteiro', () => {
  const rota = trecho("app.get('/logs/summary'", "app.get('/legal/terms'")
  assert.match(rota, /messageLog\.groupBy\(/)
  assert.ok(!rota.includes('messageLog.findMany'), 'voltou a carregar todas as linhas do período')
})

test('system/observability calcula as janelas por groupBy', () => {
  const rota = trecho("app.get('/system/observability'", "app.get('/success/overview'")
  assert.ok(!rota.includes('messageLog.findMany'), 'voltou a carregar 24 h de MessageLog em memória')
  assert.match(rota, /loadOperationalWindows\(/)
})

test('erros por mensagem somam o count das linhas agrupadas (mesmo número de antes)', () => {
  const avulsas = Array.from({ length: 5 }, () => ({ status: 'error', errorMsg: 'timeout:send:abc', sentAt: '2026-10-01T10:00:00Z' }))
  const agrupada = [{ status: 'error', errorMsg: 'timeout:send:abc', sentAt: '2026-10-01T10:00:00Z', count: 5 }]
  const a = buildErrorsByMessage(avulsas)
  const b = buildErrorsByMessage(agrupada)
  assert.equal(b[0].count, 5)
  assert.deepEqual(b, a)
})

test('25 mil linhas viram poucas linhas agrupadas, com o mesmo total', () => {
  const grupos = [
    { status: 'success', errorMsg: null, count: 20_000, sentAt: '2026-10-01T10:00:00Z' },
    { status: 'error', errorMsg: 'error:other:x', count: 5_000, sentAt: '2026-10-01T11:00:00Z' },
  ]
  assert.equal(buildErrorsByMessage(grupos)[0].count, 5_000)
})
