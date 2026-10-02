import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ANALYTICS_EVENTS } from '../src/analytics.js'
import { SESSION_TELEMETRY_EVENT, buildSessionTelemetryReport, parseTelemetryMetadata } from '../src/domain/admin/sessionTelemetry.js'

/*
 * Auditoria do admin (docs/admin/auditoria-painel-admin.md, Q1): a tela
 * "Conexão WhatsApp" do painel da cliente gravava telemetria em AdminAuditLog.
 * Medido em produção (2026-10-02): 1.568 de ~2.000 linhas da semana — 75 % da
 * trilha de auditoria não era auditoria. Agora vai para AnalyticsEvent.
 */

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('o evento está na allowlist do analytics (fora dela o evento some sem erro)', () => {
  assert.equal(SESSION_TELEMETRY_EVENT, 'session_telemetry')
  assert.ok(ANALYTICS_EVENTS.has(SESSION_TELEMETRY_EVENT))
})

test('a rota do painel da cliente NÃO grava mais em AdminAuditLog', () => {
  const fonte = read('src/api/routes/session.js')
  assert.ok(!fonte.includes("action: 'session.telemetry'"), 'telemetria voltou para AdminAuditLog')
  assert.ok(!/adminAuditLog\.create/.test(fonte), 'rota de sessão não pode escrever auditoria de admin')
  assert.match(fonte, /trackAnalyticsEvent\(\{[\s\S]*event: SESSION_TELEMETRY_EVENT/)
})

test('o leitor do admin lê de AnalyticsEvent e junta nome/e-mail em UMA consulta', () => {
  const fonte = read('src/api/routes/admin.js')
  const inicio = fonte.indexOf("app.get('/session-telemetry'")
  const corpo = fonte.slice(inicio, fonte.indexOf('\n  })\n', inicio))
  assert.match(corpo, /db\.analyticsEvent\.findMany/)
  assert.ok(!corpo.includes('adminAuditLog.findMany'), 'leitor voltou a ler da auditoria')
  assert.match(corpo, /db\.user\.findMany\(\{ where: \{ id: \{ in: userIds \} \}/, 'usuários em lote, nunca por linha')
  assert.match(corpo, /buildSessionTelemetryReport/)
})

test('relatório: parse tolerante, junção com usuário e resumo etapa:evento', () => {
  const usersById = new Map([['u1', { email: 'a@b.c', name: 'Ana' }]])
  const rows = [
    { id: 'e1', userId: 'u1', createdAt: '2026-10-02T12:00:00Z', metadata: JSON.stringify({ stage: 'qr', event: 'shown', detail: null, elapsedSec: 3 }) },
    { id: 'e2', userId: 'u1', createdAt: '2026-10-02T12:01:00Z', metadata: JSON.stringify({ stage: 'qr', event: 'shown' }) },
    { id: 'e3', userId: 'u2', createdAt: '2026-10-02T12:02:00Z', metadata: '{metadata quebrado' },
    { id: 'e4', userId: null, createdAt: '2026-10-02T12:03:00Z', metadata: { stage: 'pair', event: 'ok' } },
  ]
  const r = buildSessionTelemetryReport({ rows, usersById })
  assert.equal(r.total, 4)
  assert.deepEqual(r.summary, { 'qr:shown': 2, 'unknown:unknown': 1, 'pair:ok': 1 })
  assert.deepEqual(r.events[0].user, { email: 'a@b.c', name: 'Ana' })
  assert.equal(r.events[0].elapsedSec, 3)
  assert.equal(r.events[2].user, null)
  assert.equal(r.events[2].stage, 'unknown')
  assert.equal(r.events[3].userId, null)
})

test('parseTelemetryMetadata nunca lança', () => {
  assert.deepEqual(parseTelemetryMetadata(null), {})
  assert.deepEqual(parseTelemetryMetadata('null'), {})
  assert.deepEqual(parseTelemetryMetadata('[1]'), [1])
  assert.deepEqual(parseTelemetryMetadata('{"a":1}'), { a: 1 })
})

test('a telemetria tem retenção própria em AnalyticsEvent (senão a tabela cresce para sempre)', () => {
  const fonte = read('src/api/server.js')
  assert.match(fonte, /SESSION_TELEMETRY_RETENTION_DAYS/)
  assert.match(fonte, /analyticsEvent\.deleteMany\(\{ where: \{ event: 'session_telemetry', createdAt: \{ lt: cutoff \} \} \}\)/)
})
