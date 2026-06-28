import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../../../src/db.js'
import { configRoutes } from '../../../src/api/routes/config.js'

let counter = 0

async function buildApp() {
  const n = ++counter
  const userId = `cfg-mobileprefs-${n}-${Date.now()}`
  await db.user.create({ data: { id: userId, name: `M ${n}`, email: `mprefs-${n}-${Date.now()}@t.local`, passwordHash: 'x', plan: 'basic' } })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(configRoutes, { prefix: '/api/config' })
  app.addHook('onClose', async () => {
    await db.botConfig.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  return { app, userId }
}

test('GET / retorna defaults vazios para templates/cupons do mobile', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())
  const res = await app.inject({ method: 'GET', url: '/api/config' })
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.mobileTemplatesJson, '{}')
  assert.equal(body.mobileCouponLinksJson, '{}')
})

test('PUT / persiste e devolve templates e cupons do mobile (round-trip)', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())

  const templates = JSON.stringify({ overrides: { simples: 'novo corpo' }, custom: [{ key: 'tpl_1', name: 'Meu', body: 'x' }] })
  const coupons = JSON.stringify({ links: { shopee: 'https://s.example/c' }, cta: 'Cupom {loja}' })

  const put = await app.inject({ method: 'PUT', url: '/api/config', payload: { mobileTemplatesJson: templates, mobileCouponLinksJson: coupons } })
  assert.equal(put.statusCode, 200)

  const get = await app.inject({ method: 'GET', url: '/api/config' })
  const body = JSON.parse(get.body)
  assert.equal(body.mobileTemplatesJson, templates)
  assert.equal(body.mobileCouponLinksJson, coupons)
})

test('PUT / rejeita JSON inválido em mobileTemplatesJson', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())
  const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { mobileTemplatesJson: '{ não é json' } })
  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /mobileTemplatesJson/)
})

test('PUT / rejeita payload acima do limite de tamanho', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())
  const huge = JSON.stringify({ blob: 'a'.repeat(25_000) })
  const res = await app.inject({ method: 'PUT', url: '/api/config', payload: { mobileCouponLinksJson: huge } })
  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /tamanho máximo/)
})

test('PUT / não toca templates/cupons quando o campo não é enviado', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())

  const templates = JSON.stringify({ overrides: {}, custom: [{ key: 'tpl_keep', name: 'Keep', body: 'k' }] })
  await app.inject({ method: 'PUT', url: '/api/config', payload: { mobileTemplatesJson: templates } })
  // Atualiza outro campo sem mandar mobileTemplatesJson — deve preservar.
  await app.inject({ method: 'PUT', url: '/api/config', payload: { blockedKeywords: 'spam, cupom' } })

  const get = await app.inject({ method: 'GET', url: '/api/config' })
  const body = JSON.parse(get.body)
  assert.equal(body.mobileTemplatesJson, templates)
  assert.equal(body.blockedKeywords, 'spam, cupom')
})

test('PUT / ainda aceita defaults globais legados de espelhamento para compatibilidade', async (t) => {
  const { app } = await buildApp()
  t.after(() => app.close())

  const put = await app.inject({ method: 'PUT', url: '/api/config', payload: { mirrorTemplateKeyDefault: 'tpl_global-1', primaryLinkTargetDefault: 'last' } })
  assert.equal(put.statusCode, 200)
  const body = JSON.parse(put.body)
  assert.equal(body.mirrorTemplateKeyDefault, 'tpl_global-1')
  assert.equal(body.primaryLinkTargetDefault, 'last')

  // String vazia limpa o default (volta a relay global).
  const clear = await app.inject({ method: 'PUT', url: '/api/config', payload: { mirrorTemplateKeyDefault: '' } })
  assert.equal(clear.statusCode, 200)
  assert.equal(JSON.parse(clear.body).mirrorTemplateKeyDefault, null)

  const badKey = await app.inject({ method: 'PUT', url: '/api/config', payload: { mirrorTemplateKeyDefault: '../bad' } })
  assert.equal(badKey.statusCode, 400)
  const badTarget = await app.inject({ method: 'PUT', url: '/api/config', payload: { primaryLinkTargetDefault: 'middle' } })
  assert.equal(badTarget.statusCode, 400)
})
