// Recuperação de senha (fase 5): token assinado + as duas rotas.
// Sem banco real e sem SMTP — Prisma fingido e envio capturado.

import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import {
  signPasswordResetToken,
  verifyPasswordResetToken,
  peekPasswordResetUserId,
  DEFAULT_TTL_MS,
} from '../src/auth/passwordResetToken.js'

const SECRET = 'segredo-de-teste'
const HASH = '$2a$10$abcdefghijklmnopqrstuv'
const NOW = Date.parse('2026-08-16T12:00:00Z')

test('token válido volta com o dono certo', () => {
  const token = signPasswordResetToken({ userId: 'u1', passwordHash: HASH, secret: SECRET, now: NOW })
  const result = verifyPasswordResetToken({ token, passwordHash: HASH, secret: SECRET, now: NOW + 1000 })
  assert.deepEqual(result, { valid: true, userId: 'u1' })
})

test('token expira dentro da janela combinada', () => {
  const token = signPasswordResetToken({ userId: 'u1', passwordHash: HASH, secret: SECRET, now: NOW })
  const depois = verifyPasswordResetToken({ token, passwordHash: HASH, secret: SECRET, now: NOW + DEFAULT_TTL_MS + 1 })
  assert.equal(depois.valid, false)
  assert.equal(depois.reason, 'expired')
})

test('trocar a senha derruba qualquer link antigo (uso único de graça)', () => {
  const token = signPasswordResetToken({ userId: 'u1', passwordHash: HASH, secret: SECRET, now: NOW })
  const depoisDaTroca = verifyPasswordResetToken({ token, passwordHash: '$2a$10$OUTROHASHDEPOIS', secret: SECRET, now: NOW + 1000 })
  assert.equal(depoisDaTroca.valid, false)
  assert.equal(depoisDaTroca.reason, 'invalid')
})

test('assinatura de outro segredo não passa', () => {
  const token = signPasswordResetToken({ userId: 'u1', passwordHash: HASH, secret: 'outro', now: NOW })
  assert.equal(verifyPasswordResetToken({ token, passwordHash: HASH, secret: SECRET, now: NOW + 1000 }).valid, false)
})

test('token remendado à mão não passa', () => {
  const token = signPasswordResetToken({ userId: 'u1', passwordHash: HASH, secret: SECRET, now: NOW })
  const [id, exp, sig] = token.split('.')
  const esticado = `${id}.${Number(exp) + 10 * 60 * 1000}.${sig}`
  assert.equal(verifyPasswordResetToken({ token: esticado, passwordHash: HASH, secret: SECRET, now: NOW + 1000 }).valid, false)

  const outroDono = `${Buffer.from('u2').toString('base64url')}.${exp}.${sig}`
  assert.equal(verifyPasswordResetToken({ token: outroDono, passwordHash: HASH, secret: SECRET, now: NOW + 1000 }).valid, false)
})

test('formato quebrado não explode', () => {
  for (const token of ['', 'a', 'a.b', 'a.b.c.d', null, undefined]) {
    const result = verifyPasswordResetToken({ token, passwordHash: HASH, secret: SECRET, now: NOW })
    assert.equal(result.valid, false)
  }
  assert.equal(peekPasswordResetUserId('lixo'), null)
})

test('peek lê o dono sem autorizar nada', () => {
  const token = signPasswordResetToken({ userId: 'u-123', passwordHash: HASH, secret: SECRET, now: NOW })
  assert.equal(peekPasswordResetUserId(token), 'u-123')
})

// ------------------------------------------------------------------- rotas

async function buildApp({ users = [], sendMail = async () => ({ skipped: false }) } = {}) {
  const { default: Fastify } = await import('fastify')
  const fastifyJwt = (await import('@fastify/jwt')).default
  const { authRoutes } = await import('../src/api/routes/auth.js')

  const app = Fastify()
  await app.register(fastifyJwt, { secret: SECRET })
  app.decorate('authenticate', async (req) => { req.user = { sub: 'ninguem' } })
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.ready()
  return app
}

test('pedir link responde igual para conta que existe e para a que não existe', async (t) => {
  process.env.JWT_SECRET = SECRET
  const app = await buildApp()
  t.after(() => app.close())

  const inexistente = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: `nao-existe-${Date.now()}@exemplo.com` } })
  assert.equal(inexistente.statusCode, 200)
  assert.match(inexistente.json().message, /Se existir uma conta/)

  const semEmail = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: {} })
  assert.equal(semEmail.statusCode, 200)
  assert.deepEqual(semEmail.json().message, inexistente.json().message)
})

test('senha curta, senhas diferentes e link inválido dão recado claro', async (t) => {
  process.env.JWT_SECRET = SECRET
  const app = await buildApp()
  t.after(() => app.close())

  const curta = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'x.y.z', password: '123' } })
  assert.equal(curta.statusCode, 400)
  assert.match(curta.json().error, /8 caracteres/)

  const diferentes = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'x.y.z', password: 'senhagrande1', confirmPassword: 'outra-coisa1' } })
  assert.equal(diferentes.statusCode, 400)
  assert.match(diferentes.json().error, /não são iguais/)

  const invalido = await app.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'lixo', password: 'senhagrande1', confirmPassword: 'senhagrande1' } })
  assert.equal(invalido.statusCode, 400)
  assert.match(invalido.json().error, /não vale mais/)
})

test('o recado de link inválido não revela se a conta existe', async (t) => {
  process.env.JWT_SECRET = SECRET
  const app = await buildApp()
  t.after(() => app.close())

  const tokenDeContaInexistente = signPasswordResetToken({ userId: 'nao-existe', passwordHash: HASH, secret: SECRET })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/reset-password',
    payload: { token: tokenDeContaInexistente, password: 'senhagrande1', confirmPassword: 'senhagrande1' },
  })
  assert.equal(res.statusCode, 400)
  assert.match(res.json().error, /não vale mais/)
})

// RCA 2026-09: o pedido de link consumia o MESMO balde de tentativas do login.
// Quem erra a senha 8 vezes é exatamente quem clica em "esqueci minha senha"
// logo depois — e recebia 429 em vez do e-mail. A recuperação ficava
// indisponível justamente para quem precisa dela. Não voltar a compartilhar.
test('errar a senha várias vezes não impede pedir o link de nova senha', async (t) => {
  process.env.JWT_SECRET = SECRET
  const app = await buildApp()
  t.after(() => app.close())

  const email = `trancada-${Date.now()}@exemplo.com`
  let bloqueouLogin = false
  for (let i = 0; i < 12; i += 1) {
    const tentativa = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'errada' } })
    if (tentativa.statusCode === 429) bloqueouLogin = true
  }
  assert.equal(bloqueouLogin, true, 'o login precisa mesmo travar depois de tantas tentativas')

  const pedido = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email } })
  assert.equal(pedido.statusCode, 200)
  assert.match(pedido.json().message, /Se existir uma conta/)
})

test('pedir link muitas vezes seguidas ainda é barrado (balde próprio)', async (t) => {
  process.env.JWT_SECRET = SECRET
  const app = await buildApp()
  t.after(() => app.close())

  const email = `insistente-${Date.now()}@exemplo.com`
  let ultimo = null
  for (let i = 0; i < 12; i += 1) {
    ultimo = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email } })
  }
  assert.equal(ultimo.statusCode, 429)
})

test('o hash guardado muda de verdade quando a senha é trocada', async () => {
  // Prova o contrato que o token depende: bcrypt gera hash novo, então a
  // assinatura antiga deixa de bater (uso único).
  const antes = await bcrypt.hash('senha-velha', 10)
  const depois = await bcrypt.hash('senha-nova', 10)
  assert.notEqual(antes, depois)
  const token = signPasswordResetToken({ userId: 'u1', passwordHash: antes, secret: SECRET })
  assert.equal(verifyPasswordResetToken({ token, passwordHash: depois, secret: SECRET }).valid, false)
})
