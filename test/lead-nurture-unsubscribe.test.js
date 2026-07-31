import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../src/leadNurture/unsubscribeToken.js'
import { leadNurtureRoutes } from '../src/api/routes/leadNurture.js'
import db from '../src/db.js'

const SECRET = 'test-secret-key-nao-usar-em-producao'

test('round-trip: verify(sign(userId)) extrai o mesmo userId', () => {
  const userId = 'clx1234567890abcdef'
  const token = signUnsubscribeToken(userId, SECRET)
  const result = verifyUnsubscribeToken(token, SECRET)
  assert.deepEqual(result, { userId })
})

test('token adulterado (assinatura trocada) é rejeitado', () => {
  const userId = 'clx1234567890abcdef'
  const token = signUnsubscribeToken(userId, SECRET)
  const [encodedUserId] = token.split('.')
  const tampered = `${encodedUserId}.${'0'.repeat(64)}`
  assert.equal(verifyUnsubscribeToken(tampered, SECRET), null)
})

test('token malformado (sem ponto) é rejeitado', () => {
  assert.equal(verifyUnsubscribeToken('token-sem-formato-correto', SECRET), null)
})

test('token vazio/ausente é rejeitado', () => {
  assert.equal(verifyUnsubscribeToken('', SECRET), null)
  assert.equal(verifyUnsubscribeToken(null, SECRET), null)
  assert.equal(verifyUnsubscribeToken(undefined, SECRET), null)
})

test('token assinado com secret diferente é rejeitado', () => {
  const userId = 'clx1234567890abcdef'
  const token = signUnsubscribeToken(userId, SECRET)
  assert.equal(verifyUnsubscribeToken(token, 'outro-secret-diferente'), null)
})

test('token com userId codificado inválido é rejeitado sem lançar', () => {
  assert.equal(verifyUnsubscribeToken('***.abc', SECRET), null)
})

// --- Parte 2: rota HTTP GET /api/lead-nurture/unsubscribe (T016) ---

async function buildApp() {
  process.env.JWT_SECRET = SECRET
  const app = Fastify({ logger: false })
  await app.register(leadNurtureRoutes, { prefix: '/api/lead-nurture' })
  return app
}

test('rota: token válido responde 200 pt-BR e grava nurture_unsubscribed exatamente 1x mesmo com 2 chamadas', async () => {
  const app = await buildApp()
  const userId = `lead-nurture-http-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const token = signUnsubscribeToken(userId, SECRET)

  try {
    const res1 = await app.inject({ method: 'GET', url: `/api/lead-nurture/unsubscribe?token=${encodeURIComponent(token)}` })
    assert.equal(res1.statusCode, 200)
    assert.match(res1.body, /descadastrada/i)

    const res2 = await app.inject({ method: 'GET', url: `/api/lead-nurture/unsubscribe?token=${encodeURIComponent(token)}` })
    assert.equal(res2.statusCode, 200)

    const events = await db.analyticsEvent.findMany({ where: { userId, event: 'nurture_unsubscribed' } })
    assert.equal(events.length, 1)
  } finally {
    await db.analyticsEvent.deleteMany({ where: { userId } })
    await app.close()
  }
})

test('rota: token ausente responde 400 sem vazar userId/e-mail', async () => {
  const app = await buildApp()
  try {
    const res = await app.inject({ method: 'GET', url: '/api/lead-nurture/unsubscribe' })
    assert.equal(res.statusCode, 400)
    assert.doesNotMatch(res.body, /@/)
  } finally {
    await app.close()
  }
})

test('rota: token malformado/HMAC inválido responde 400', async () => {
  const app = await buildApp()
  try {
    const res = await app.inject({ method: 'GET', url: '/api/lead-nurture/unsubscribe?token=lixo-invalido' })
    assert.equal(res.statusCode, 400)
  } finally {
    await app.close()
  }
})
