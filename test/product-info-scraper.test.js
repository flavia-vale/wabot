import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { fetchProductInfo } from '../src/converters/productInfoScraper.js'

function startServer(html, { contentType = 'text/html; charset=utf-8' } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', contentType)
      res.end(html)
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

test('fetchProductInfo extrai título e preços de JSON-LD Product', async (t) => {
  const html = `
    <html><head>
      <title>Loja</title>
      <meta property="og:title" content="Mixer Vertical Turbo Chef" />
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","name":"Mixer Vertical Turbo Chef Elgin",
         "offers":{"@type":"Offer","price":"149.90","priceCurrency":"BRL",
         "priceSpecification":{"@type":"UnitPriceSpecification","priceType":"https://schema.org/ListPrice","price":"199.90"}}}
      </script>
    </head><body></body></html>`
  const server = await startServer(html)
  t.after(() => close(server))
  const { port } = server.address()

  const info = await fetchProductInfo(`http://127.0.0.1:${port}/produto`)
  assert.equal(info.title, 'Mixer Vertical Turbo Chef Elgin')
  assert.equal(info.newPrice, '149,90')
  assert.equal(info.oldPrice, '199,90')
})

test('fetchProductInfo cai para og:title e meta price quando não há JSON-LD', async (t) => {
  const html = `
    <html><head>
      <meta property="og:title" content="Produto Top" />
      <meta property="product:price:amount" content="89.50" />
    </head></html>`
  const server = await startServer(html)
  t.after(() => close(server))
  const { port } = server.address()

  const info = await fetchProductInfo(`http://127.0.0.1:${port}/x`)
  assert.equal(info.title, 'Produto Top')
  assert.equal(info.newPrice, '89,50')
  assert.equal(info.oldPrice, '')
})

test('fetchProductInfo devolve campos vazios quando não há HTML utilizável', async (t) => {
  const server = await startServer('{}', { contentType: 'application/json' })
  t.after(() => close(server))
  const { port } = server.address()

  const info = await fetchProductInfo(`http://127.0.0.1:${port}/api`)
  assert.equal(info.title, '')
  assert.equal(info.newPrice, '')
  assert.equal(info.oldPrice, '')
})
