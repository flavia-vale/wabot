import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { buildMlAuthUrl, mlOAuthRoutes, resolveMlOAuthRedirectUri } from '../../../src/api/routes/mlOAuth.js'

function withEnv(env, fn) {
  const previous = {}
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key]
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
}

async function buildApp({ userId = 'user-1', jwtSecret = 'test-secret' } = {}) {
  const app = Fastify({ logger: false })
  await app.register(fastifyJwt, { secret: jwtSecret })
  app.decorate('authenticate', async (req, reply) => {
    try {
      req.user = app.jwt.verify(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
    } catch {
      return reply.code(401).send({ error: 'Não autorizado' })
    }
  })
  await app.register(mlOAuthRoutes, { prefix: '/api/auth' })
  const token = app.jwt.sign({ sub: userId, email: 'user@example.com', jti: 'jti-1' })
  return { app, token }
}

test('resolveMlOAuthRedirectUri normaliza DASHBOARD_URL e monta callback do proxy', async () => {
  await withEnv({ DASHBOARD_URL: 'http://178.105.54.0:3006/' }, async () => {
    assert.equal(resolveMlOAuthRedirectUri(), 'http://178.105.54.0:3006/api/auth/ml-oauth/callback')
  })
})

test('buildMlAuthUrl inclui state, client_id e redirect_uri exato', () => {
  const url = new URL(buildMlAuthUrl('client-123', 'state-token', 'http://178.105.54.0:3006/api/auth/ml-oauth/callback'))
  assert.equal(url.origin + url.pathname, 'https://auth.mercadolivre.com.br/authorization')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'client-123')
  assert.equal(url.searchParams.get('state'), 'state-token')
  assert.equal(url.searchParams.get('redirect_uri'), 'http://178.105.54.0:3006/api/auth/ml-oauth/callback')
})

test('GET /ml-oauth/start-url retorna URL OAuth para usuário autenticado', async () => {
  await withEnv({ ML_CLIENT_ID: 'client-123', DASHBOARD_URL: 'http://178.105.54.0:3006' }, async () => {
    const { app, token } = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/ml-oauth/start-url',
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    const url = new URL(body.url)
    assert.equal(url.searchParams.get('client_id'), 'client-123')
    assert.equal(url.searchParams.get('redirect_uri'), 'http://178.105.54.0:3006/api/auth/ml-oauth/callback')
    assert.ok(url.searchParams.get('state'))
    await app.close()
  })
})

test('GET /ml-oauth/start-url falha com erro de configuração quando DASHBOARD_URL falta', async () => {
  await withEnv({ ML_CLIENT_ID: 'client-123', DASHBOARD_URL: undefined }, async () => {
    const { app, token } = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/ml-oauth/start-url',
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(res.statusCode, 503)
    assert.deepEqual(JSON.parse(res.body), {
      error: 'DASHBOARD_URL não configurado',
      code: 'ML_OAUTH_CONFIG_MISSING',
    })
    await app.close()
  })
})
