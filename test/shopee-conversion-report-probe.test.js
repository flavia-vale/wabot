import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildConversionReportQuery,
  buildTypeQuery,
  credentialNotFoundHint,
  discoverSelection,
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

test('orienta omitir user-id quando há somente uma credencial', () => {
  assert.match(credentialNotFoundHint(1), /sem --user-id/)
  assert.match(credentialNotFoundHint(2), /--list-users/)
})

test('query da prova técnica usa a seleção descoberta e é somente leitura', () => {
  const query = buildConversionReportQuery({ start: 10, end: 20, selection: ['conversionId', 'orders { orderId }'] })
  assert.match(query, /^query \{/)
  assert.match(query, /conversionReport\(purchaseTimeStart: 10, purchaseTimeEnd: 20\)/)
  assert.match(query, /nodes \{ conversionId orders \{ orderId \} \}/)
  assert.doesNotMatch(query, /mutation/i)
})

test('introspecção descobre escalares e objetos aninhados sem adivinhar o schema', async () => {
  assert.match(buildTypeQuery('ConversionReport'), /__type\(name: "ConversionReport"\)/)
  const types = {
    ConversionReport: { fields: [
      { name: 'conversionId', args: [], type: { kind: 'SCALAR', name: 'String' } },
      { name: 'orders', args: [], type: { kind: 'LIST', ofType: { kind: 'OBJECT', name: 'Order' } } },
      { name: 'unsafe', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } } }], type: { kind: 'SCALAR', name: 'String' } },
    ] },
    Order: { fields: [
      { name: 'orderId', args: [], type: { kind: 'SCALAR', name: 'String' } },
      { name: 'orderStatus', args: [], type: { kind: 'ENUM', name: 'OrderStatus' } },
    ] },
  }
  assert.deepEqual(await discoverSelection('ConversionReport', async name => types[name]), [
    'conversionId',
    'orders { orderId orderStatus }',
  ])
})

test('resumo conta conversões da tag sem expor identificadores', () => {
  const summary = summarizeReport([
    { utmContent: '[espelhagrupos]', orders: [{ orderStatus: 'PENDING', referrer: 'https://chat.whatsapp.com/private-path', estimatedCommission: '1.25', orderId: 'sensitive' }] },
    { orders: [{ orderStatus: 'PENDING', referrer: 'other', sellerCommission: 2 }] },
    { orders: [{ orderStatus: 'COMPLETED', referrer: 'espelhagrupos', estimatedCommission: null }] },
  ])
  assert.deepEqual(summary, {
    rows: 3,
    taggedEspelhaGrupos: 2,
    attributionBreakdown: {
      'utmContent=[espelhagrupos]': 1,
      'orders[0].referrer=url:chat.whatsapp.com': 1,
      'orders[0].referrer=other': 1,
      'orders[0].referrer=espelhagrupos': 1,
    },
    byStatus: {
      'orders[0].orderStatus=PENDING': 2,
      'orders[0].orderStatus=COMPLETED': 1,
    },
    commissionTotals: {
      'orders[0].estimatedCommission': 1.25,
      'orders[0].sellerCommission': 2,
    },
  })
  assert.equal('orderId' in summary, false)
})
