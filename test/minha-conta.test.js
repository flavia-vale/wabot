// Minha conta (2026-09-23): a cliente corrige o próprio nome pela tela. O
// celular de cadastro NÃO é editável — ele é a trava contra teste grátis
// repetido.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import db from '../src/db.js'
import { authRoutes } from '../src/api/routes/auth.js'

async function buildApp() {
  const id = `u-conta-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({ data: { id, name: 'Nome Antigo', email: `${id}@minha-conta.test`, passwordHash: 'x', plan: 'basic', contactPhone: `55119${Date.now().toString().slice(-8)}` } })
  const app = Fastify({ logger: false })
  await app.register(jwt, { secret: 'segredo-de-teste-minha-conta' })
  app.decorate('authenticate', async (req) => { req.user = { sub: id } })
  await app.register(authRoutes, { prefix: '/api/auth' })
  app.addHook('onClose', async () => { await db.user.deleteMany({ where: { id } }) })
  return { app, id }
}

test('PATCH /me/name troca o nome e devolve a conta', async () => {
  const { app, id } = await buildApp()
  const res = await app.inject({ method: 'PATCH', url: '/api/auth/me/name', payload: { name: '  Sol   Almeida ' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.json().name, 'Sol Almeida')
  assert.equal((await db.user.findUnique({ where: { id } })).name, 'Sol Almeida')
  await app.close()
})

test('PATCH /me/name recusa vazio e nome longo demais', async () => {
  const { app } = await buildApp()
  assert.equal((await app.inject({ method: 'PATCH', url: '/api/auth/me/name', payload: { name: '   ' } })).statusCode, 400)
  assert.equal((await app.inject({ method: 'PATCH', url: '/api/auth/me/name', payload: { name: 'a'.repeat(101) } })).statusCode, 400)
  await app.close()
})

test('a rota de nome nunca grava o celular, mesmo se ele vier no corpo', async () => {
  const { app, id } = await buildApp()
  const antes = (await db.user.findUnique({ where: { id } })).contactPhone
  await app.inject({ method: 'PATCH', url: '/api/auth/me/name', payload: { name: 'Outra', contactPhone: '5511999999999' } })
  assert.equal((await db.user.findUnique({ where: { id } })).contactPhone, antes)
  await app.close()
})

test('a tela Minha conta existe, está no menu e mostra o celular só para leitura', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/conta/page.js', import.meta.url), 'utf8')
  const nav = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
  assert.match(nav, /label: 'Minha conta',\n\s+href: '\/painel\/conta'/)
  assert.match(page, /updateAccountName/)
  assert.match(page, /contactPhone/)
  assert.doesNotMatch(page, /updateAccountPhone|me\/phone/)
})
