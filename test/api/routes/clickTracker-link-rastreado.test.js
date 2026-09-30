// Link rastreado no robô (src/core/trackedLinks.js): o que o GET /r/:hash
// precisa garantir para o shortlink poder ir no texto da oferta.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { clickTrackerRoutes, isNonHumanUserAgent } from '../../../src/api/routes/clickTracker.js'
import { createShortlink } from '../../../src/core/clickTracker.js'

let counter = 0

async function buildApp() {
  const n = ++counter
  const userId = `user-rastreado-${n}`
  await db.user.create({
    data: { id: userId, name: `U ${n}`, email: `rastreado-${n}@t.local`, passwordHash: 'x' },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(clickTrackerRoutes)
  return { app, userId }
}

async function cleanup(app, userId) {
  const links = await db.affiliateLink.findMany({ where: { userId }, select: { id: true } })
  await db.affiliateClick.deleteMany({ where: { linkId: { in: links.map(l => l.id) } } })
  await db.affiliateLink.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
  await app.close()
}

test('GET /r/:hash devolve o link de afiliado BYTE A BYTE (tag, parâmetros e escapes intactos)', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => cleanup(app, userId))
  const convertido = 'https://produto.mercadolivre.com.br/MLB-123-x_JM?matt_tool=12345678&matt_word=cliente%20x&forceInApp=true#reviews'
  const { hash, shortUrl } = await createShortlink(userId, convertido, { baseUrl: 'https://espelhagrupos.com.br/' })
  assert.equal(shortUrl, `https://espelhagrupos.com.br/r/${hash}`)
  const res = await app.inject({ method: 'GET', url: `/r/${hash}`, headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Mobile' } })
  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.location, convertido)
  assert.match(String(res.headers['cache-control']), /no-store/)
  assert.match(String(res.headers['x-robots-tag']), /noindex/)
})

test('GET /r/:hash recusa destino que não é link de loja (não vira redirecionador aberto)', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => cleanup(app, userId))
  await db.affiliateLink.create({ data: { userId, hash: 'phish001', originalUrl: 'https://example.com/login' } })
  const res = await app.inject({ method: 'GET', url: '/r/phish001' })
  assert.equal(res.statusCode, 404)
  assert.equal(res.headers.location, undefined)
})

test('GET /r/:hash recusa host que só IMITA loja (amazon.com.br.evil.net)', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => cleanup(app, userId))
  await db.affiliateLink.create({ data: { userId, hash: 'phish002', originalUrl: 'https://amazon.com.br.evil.net/dp/B0' } })
  const res = await app.inject({ method: 'GET', url: '/r/phish002' })
  assert.equal(res.statusCode, 404)
})

test('GET /r/:hash com hash fora do formato responde 404', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => cleanup(app, userId))
  const res = await app.inject({ method: 'GET', url: '/r/' + 'a'.repeat(40) })
  assert.equal(res.statusCode, 404)
})

test('POST /api/links/shortlink recusa link que não é de loja', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => cleanup(app, userId))
  const res = await app.inject({ method: 'POST', url: '/api/links/shortlink', payload: { originalUrl: 'https://example.com/produto' } })
  assert.equal(res.statusCode, 400)
})

test('GET /r/:hash de robô/cliente HTTP redireciona mas NÃO conta clique; gente conta', async (t) => {
  const { app, userId } = await buildApp()
  t.after(() => cleanup(app, userId))
  const link = await db.affiliateLink.create({ data: { userId, hash: 'botua001', originalUrl: 'https://amzn.to/3abcDEF' } })
  for (const ua of ['', 'node', 'facebookexternalhit/1.1', 'Mozilla/5.0 (compatible; Googlebot/2.1)']) {
    const res = await app.inject({ method: 'GET', url: '/r/botua001', headers: { 'user-agent': ua } })
    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.location, 'https://amzn.to/3abcDEF')
  }
  for (const ua of ['Mozilla/5.0 (iPhone) AppleWebKit WhatsApp/2.24.1', 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) Chrome/120 Mobile']) {
    await app.inject({ method: 'GET', url: '/r/botua001', headers: { 'user-agent': ua } })
  }
  await new Promise(resolve => setTimeout(resolve, 100))
  const clicks = await db.affiliateClick.count({ where: { linkId: link.id } })
  assert.equal(clicks, 2)
})

test('isNonHumanUserAgent: crawler/cliente HTTP sim; navegador do celular não', () => {
  for (const ua of [undefined, '', 'node', 'undici', 'curl/8.4.0', 'python-requests/2.31', 'Twitterbot/1.0', 'Mozilla/5.0 (compatible; bingbot/2.0)']) {
    assert.equal(isNonHumanUserAgent(ua), true, `deveria filtrar: ${ua}`)
  }
  for (const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148 Safari/604.1', 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) Chrome/120 Mobile', 'Mozilla/5.0 WhatsApp/2.24.1 A']) {
    assert.equal(isNonHumanUserAgent(ua), false, `não deveria filtrar: ${ua}`)
  }
})
