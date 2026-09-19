import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFinancePeriod, FINANCE_PERIODS } from '../src/domain/admin/financePeriod.js'

/*
 * Filtros de tempo da aba Financeiro do admin (2026-09-17): 7 dias, 30 dias,
 * mês atual, último mês, 3 meses, 6 meses — os mesmos nos Cards (Visão geral)
 * e na tabela de Cobranças recorrentes.
 */

test('FINANCE_PERIODS tem exatamente os seis períodos pedidos, na ordem', () => {
  assert.deepEqual(FINANCE_PERIODS.map((p) => p.value), ['7d', '30d', 'current_month', 'last_month', '3m', '6m'])
})

test('7d e 30d são janelas corridas a partir de agora', () => {
  const now = new Date('2026-09-17T15:00:00Z')
  const r7 = resolveFinancePeriod('7d', { now })
  assert.equal(r7.end.getTime(), now.getTime())
  assert.equal(r7.start.getTime(), now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const r30 = resolveFinancePeriod('30d', { now })
  assert.equal(r30.start.getTime(), now.getTime() - 30 * 24 * 60 * 60 * 1000)
})

test('mês atual começa no dia 1 às 0h em America/Sao_Paulo, não em UTC', () => {
  // 2026-09-01T02:30:00Z = 2026-08-31T23:30 em Brasília (UTC-3) — ainda é
  // o mês anterior no fuso local, mesmo já sendo dia 1 em UTC.
  const now = new Date('2026-09-01T02:30:00Z')
  const range = resolveFinancePeriod('current_month', { now })
  // Início do mês local (agosto) em UTC-3 -> 2026-08-01T03:00:00Z
  assert.equal(range.start.toISOString(), '2026-08-01T03:00:00.000Z')
  assert.equal(range.end.getTime(), now.getTime())
})

test('mês atual, depois da virada de mês, começa em setembro', () => {
  const now = new Date('2026-09-17T15:00:00Z')
  const range = resolveFinancePeriod('current_month', { now })
  assert.equal(range.start.toISOString(), '2026-09-01T03:00:00.000Z')
})

test('último mês é o mês FECHADO anterior — não inclui nada do mês atual', () => {
  const now = new Date('2026-09-17T15:00:00Z')
  const range = resolveFinancePeriod('last_month', { now })
  assert.equal(range.start.toISOString(), '2026-08-01T03:00:00.000Z')
  // Termina exatamente onde o mês atual começa — sem sobreposição e sem buraco.
  assert.equal(range.end.toISOString(), '2026-09-01T03:00:00.000Z')
})

test('3 meses e 6 meses são calendário corrido até agora, não múltiplo de 30 dias', () => {
  const now = new Date('2026-09-17T15:00:00Z')
  const r3 = resolveFinancePeriod('3m', { now })
  // Mês atual (setembro) + 2 anteriores completos = a partir de 1º de julho.
  assert.equal(r3.start.toISOString(), '2026-07-01T03:00:00.000Z')
  assert.equal(r3.end.getTime(), now.getTime())

  const r6 = resolveFinancePeriod('6m', { now })
  // Setembro + 5 anteriores = a partir de 1º de abril.
  assert.equal(r6.start.toISOString(), '2026-04-01T03:00:00.000Z')
})

test('período desconhecido ou ausente cai no padrão de 30 dias, nunca quebra', () => {
  const now = new Date('2026-09-17T15:00:00Z')
  assert.equal(resolveFinancePeriod(undefined, { now }).period, '30d')
  assert.equal(resolveFinancePeriod('', { now }).period, '30d')
  assert.equal(resolveFinancePeriod('bimestre-fiscal', { now }).period, '30d')
})

test('cada período devolve um label legível para a tela', () => {
  const now = new Date('2026-09-17T15:00:00Z')
  for (const { value, label } of FINANCE_PERIODS) {
    const range = resolveFinancePeriod(value, { now })
    assert.equal(range.label, label)
    assert.ok(range.start < range.end || range.start.getTime() === range.end.getTime())
  }
})
