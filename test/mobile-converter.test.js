import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getConvertedLinksText,
  getMobileConversionSummary,
  normalizeMobileConversionResults,
} from '../dashboard/lib/mobileConverter.js'

test('normaliza múltiplos resultados convertidos e com erro por item', () => {
  const results = normalizeMobileConversionResults({
    results: [
      { index: 1, label: 'Amazon', originalUrl: 'https://amazon.test/p', convertedUrl: 'https://amzn.to/a', status: 'converted' },
      { index: 2, label: 'Shopee', originalUrl: 'https://shopee.test/p', status: 'error', error: 'Credenciais ausentes' },
    ],
  })

  assert.equal(results.length, 2)
  assert.equal(results[0].ok, true)
  assert.equal(results[0].displayUrl, 'https://amzn.to/a')
  assert.equal(results[1].ok, false)
  assert.equal(results[1].error, 'Credenciais ausentes')
})

test('texto para copiar todos contém só links convertidos', () => {
  const text = getConvertedLinksText([
    { ok: true, convertedUrl: 'https://ok.test/1' },
    { ok: false, convertedUrl: '' },
    { ok: true, convertedUrl: 'https://ok.test/2' },
  ])

  assert.equal(text, 'https://ok.test/1\nhttps://ok.test/2')
})

test('resumo mobile usa contagem real dos itens normalizados', () => {
  const summary = getMobileConversionSummary([
    { ok: true },
    { ok: false },
    { ok: true },
  ])

  assert.deepEqual(summary, { total: 3, converted: 2, failed: 1 })
})
