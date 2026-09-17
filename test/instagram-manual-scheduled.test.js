import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { instagramRoutes } from '../src/api/routes/instagram.js'
import { downloadStoryImage, scopeStoryIdempotencyKey } from '../src/instagram/storyDeliveryService.js'

test('downloader limita redirects e bloqueia redirect para rede interna', async () => {
  await assert.rejects(downloadStoryImage('https://example.com/a.jpg', { fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }) }), error => error.code === 'SSRF_BLOCKED')
})

test('idempotência de Story é opaca e isolada por usuário', () => {
  const first = scopeStoryIdempotencyKey('u1', 'mesma-chave')
  assert.match(first, /^igv1:u1:[a-f0-9]{64}$/)
  assert.equal(scopeStoryIdempotencyKey('u1', first), first)
  assert.notEqual(first, scopeStoryIdempotencyKey('u2', 'mesma-chave'))
})

async function appFor(creator) {
  const app = Fastify()
  app.decorate('authenticate', async req => { req.user = { sub: 'premium-user' } })
  const db = { storyPublication: { findMany: async () => [], updateMany: async () => ({ count: 1 }) } }
  await app.register(instagramRoutes, { prefix: '/api/instagram', db, env: {}, storage: {}, publishingQueue: { cancel: async () => true }, createAndEnqueueStory: creator })
  return app
}

test('envio manual cria resultado independente por destino', async () => {
  const calls = []
  const app = await appFor(async input => { calls.push(input); if (input.destinationId === 'bad') throw Object.assign(new Error('falhou'), { code: 'DESTINATION_UNAVAILABLE' }); return { id: `p-${input.destinationId}`, status: 'queued', scheduledFor: null } })
  const response = await app.inject({ method: 'POST', url: '/api/instagram/stories', payload: { destinationIds: ['ok', 'bad'], offer: { title: 'Oferta' }, imageUrl: 'https://example.com/a.jpg', idempotencyKey: 'idem' } })
  assert.equal(response.statusCode, 202)
  assert.equal(response.json().publications.length, 1)
  assert.equal(response.json().errors.length, 1)
  assert.equal(calls[0].sourceType, 'manual')
  assert.equal(calls[0].idempotencyKey, 'idem:ok')
  await app.close()
})

test('agendamento exige futuro e propaga origem scheduled', async () => {
  let captured
  const app = await appFor(async input => { captured = input; return { id: 'p1', status: 'queued', scheduledFor: input.scheduledFor } })
  const invalid = await app.inject({ method: 'POST', url: '/api/instagram/stories', payload: { destinationIds: ['d1'], offer: { title: 'Oferta' }, imageUrl: 'https://example.com/a.jpg', scheduledFor: '2020-01-01' } })
  assert.equal(invalid.statusCode, 400)
  const tooFar = await app.inject({ method: 'POST', url: '/api/instagram/stories', payload: { destinationIds: ['d1'], offer: { title: 'Oferta' }, imageUrl: 'https://example.com/a.jpg', scheduledFor: new Date(Date.now() + 31 * 24 * 60 * 60_000).toISOString() } })
  assert.equal(tooFar.statusCode, 400)
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60_000).toISOString()
  const valid = await app.inject({ method: 'POST', url: '/api/instagram/stories', payload: { destinationIds: ['d1'], offer: { title: 'Oferta' }, imageUrl: 'https://example.com/a.jpg', scheduledFor } })
  assert.equal(valid.statusCode, 202)
  assert.equal(captured.sourceType, 'scheduled')
  await app.close()
})

test('cancelamento só aceita Story futuro ainda em queued', async () => {
  const app = await appFor(async () => ({}))
  const response = await app.inject({ method: 'DELETE', url: '/api/instagram/stories/p1' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), { ok: true })
  await app.close()
})
