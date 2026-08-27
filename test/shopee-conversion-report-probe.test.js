import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConversionReportQuery,
  parseArgs,
  summarizeReport,
} from '../scripts/shopee-conversion-report-probe.mjs'

test('probe limita a janela e exige argumentos conhecidos', () => {
  assert.deepEqual(parseArgs(['--user-id', 'user-1', '--days', '3']), {
    days: 3,
    listUsers: false,
    showSample: false,
    userId: 'user-1',
  })
  assert.throws(() => parseArgs(['--days', '8']), /entre 1 e 7/)
  assert.throws(() => parseArgs(['--write']), /desconhecido/)
})

test('query da prova técnica é somente leitura e pede SubIDs', () => {
  const query = buildConversionReportQuery({ start: 10, end: 20 })
  assert.match(query, /^query \{/)
  assert.match(query, /conversionReport\(purchaseTimeStart: 10, purchaseTimeEnd: 20\)/)
  assert.match(query, /subId1 subId2 subId3 subId4 subId5/)
  assert.doesNotMatch(query, /mutation/i)
})

test('resumo conta conversões da tag sem expor identificadores', () => {
  const summary = summarizeReport([
    { status: 'PENDING', subId1: 'espelhagrupos', estimatedCommission: '1.25', orderId: 'sensitive' },
    { status: 'PENDING', subId2: 'other', estimatedCommission: 2 },
    { status: 'COMPLETED', subId3: 'espelhagrupos', estimatedCommission: null },
  ])
  assert.deepEqual(summary, {
    rows: 3,
    taggedEspelhaGrupos: 2,
    byStatus: { PENDING: 2, COMPLETED: 1 },
    estimatedCommission: 3.25,
  })
  assert.equal('orderId' in summary, false)
})
