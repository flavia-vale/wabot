import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMobileOfferUrlFromConversion,
  getConvertedLinksText,
  getMobileConversionSummary,
  normalizeMobileConversionResults,
  validateMobileConverterInput,
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

test('handoff para oferta usa convertedUrl apenas quando o item converteu', () => {
  assert.equal(
    buildMobileOfferUrlFromConversion({ ok: true, convertedUrl: ' https://afiliado.test/produto?x=1&y=2 ' }),
    '/painel/criar-oferta?url=https%3A%2F%2Fafiliado.test%2Fproduto%3Fx%3D1%26y%3D2',
  )
  assert.equal(
    buildMobileOfferUrlFromConversion({ ok: false, convertedUrl: 'https://nao-deve-ir.test', originalUrl: 'https://original.test' }),
    '/painel/criar-oferta',
  )
})

test('validação mobile bloqueia texto vazio e links separados por ponto e vírgula', () => {
  assert.match(validateMobileConverterInput('   '), /pelo menos um link/i)
  assert.match(validateMobileConverterInput('https://a.test; https://b.test'), /ponto e vírgula/i)
  assert.equal(validateMobileConverterInput('https://a.test\nhttps://b.test'), '')
})
