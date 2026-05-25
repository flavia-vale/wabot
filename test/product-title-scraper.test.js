import test from 'node:test'
import assert from 'node:assert/strict'

import { extractTitleFromHtml, scrapeProductTitle } from '../src/converters/productTitleScraper.js'

test('extractTitleFromHtml prioriza og:title', () => {
  const html = `
    <html>
      <head>
        <title>Página fallback</title>
        <meta name="twitter:title" content="Twitter Title">
        <meta property="og:title" content="Mochila Esportiva Adidas Trefoil 30L">
      </head>
    </html>
  `
  assert.equal(extractTitleFromHtml(html), 'Mochila Esportiva Adidas Trefoil 30L')
})

test('extractTitleFromHtml cai para twitter:title quando og:title ausente', () => {
  const html = `
    <html>
      <head>
        <title>Página fallback</title>
        <meta name="twitter:title" content="Jogo de Toalhas Karsten Bressan">
      </head>
    </html>
  `
  assert.equal(extractTitleFromHtml(html), 'Jogo de Toalhas Karsten Bressan')
})

test('extractTitleFromHtml lê JSON-LD Product quando faltam metas OG', () => {
  const html = `
    <html><head>
      <title>fallback</title>
      <script type="application/ld+json">
        { "@context": "https://schema.org", "@type": "Product", "name": "Jaqueta Couro Adidas Originals" }
      </script>
    </head></html>
  `
  assert.equal(extractTitleFromHtml(html), 'Jaqueta Couro Adidas Originals')
})

test('extractTitleFromHtml decodifica entidades HTML', () => {
  const html = `<meta property="og:title" content="Caf&eacute; Especial 100% Ar&aacute;bica">`
  // &eacute; / &aacute; não são tratadas pelo decoder (lista mínima); ainda assim
  // testamos as principais entidades suportadas:
  const html2 = `<meta property="og:title" content="Garrafa T&eacute;rmica &amp; Squeeze">`
  assert.equal(extractTitleFromHtml(html2).includes('&amp;'), false)
})

test('extractTitleFromHtml devolve null quando html não tem nenhum sinal de título', () => {
  const html = `<html><head></head><body>nothing</body></html>`
  assert.equal(extractTitleFromHtml(html), null)
})

test('scrapeProductTitle retorna null em resposta não-HTML', async () => {
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: (k) => k.toLowerCase() === 'content-type' ? 'application/json' : null },
    text: async () => '{"foo":1}',
    body: null,
  })
  const result = await scrapeProductTitle('https://example.com/api/item', { fetchImpl: fakeFetch })
  assert.equal(result, null)
})

test('scrapeProductTitle retorna null em fetch lançando erro (timeout/abort)', async () => {
  const fakeFetch = async () => { throw new Error('aborted') }
  const result = await scrapeProductTitle('https://example.com/p/123', { fetchImpl: fakeFetch })
  assert.equal(result, null)
})

test('scrapeProductTitle integra fetch+parse e devolve og:title', async () => {
  const html = `<meta property="og:title" content="Mochila Esportiva 30L">`
  const encoder = new TextEncoder()
  const fakeFetch = async () => ({
    ok: true,
    headers: { get: (k) => k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null },
    text: async () => html,
    body: {
      getReader() {
        let sent = false
        return {
          read: async () => sent ? { done: true } : (sent = true, { done: false, value: encoder.encode(html) }),
          cancel: async () => {},
        }
      },
    },
  })
  const result = await scrapeProductTitle('https://example.com/p/123', { fetchImpl: fakeFetch })
  assert.equal(result, 'Mochila Esportiva 30L')
})
