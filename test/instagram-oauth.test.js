import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInstagramAuthorizationUrl, instagramOAuthConfig } from '../src/instagram/oauth/config.js'
import { createInstagramOAuthClient } from '../src/instagram/oauth/client.js'
import { beginInstagramOAuth, completeInstagramOAuth } from '../src/instagram/oauth/service.js'

const ENV = { NODE_ENV: 'test', INSTAGRAM_APP_ID: 'app', INSTAGRAM_APP_SECRET: 'secret', INSTAGRAM_REDIRECT_URI: 'http://local/callback', INSTAGRAM_GRAPH_API_VERSION: 'v25.0' }

test('config OAuth é estrita e autorização pede somente escopos de publicação', () => {
  const config = instagramOAuthConfig(ENV)
  const url = new URL(buildInstagramAuthorizationUrl(config, 'state-1'))
  assert.equal(url.hostname, 'www.instagram.com')
  assert.equal(url.searchParams.get('state'), 'state-1')
  assert.equal(url.searchParams.get('scope'), 'instagram_business_basic,instagram_business_content_publish')
  assert.throws(() => instagramOAuthConfig({ ...ENV, INSTAGRAM_GRAPH_API_VERSION: 'latest' }), /incompleta/)
})

test('cliente Facebook descobre uma única conta profissional vinculada', async () => {
  const config = instagramOAuthConfig({ ...ENV, INSTAGRAM_LOGIN_METHOD: 'facebook_login' })
  const client = createInstagramOAuthClient(config, { fetchImpl: async () => new Response(JSON.stringify({ data: [{ instagram_business_account: { id: 'ig1', username: 'loja' } }] }), { status: 200 }) })
  assert.equal((await client.profile('token')).id, 'ig1')
})

test('cliente OAuth classifica indisponibilidade da Meta como transitória', async () => {
  const config = instagramOAuthConfig(ENV)
  const unavailable = createInstagramOAuthClient(config, { fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'indisponível', is_transient: true } }), { status: 503 }) })
  await assert.rejects(unavailable.profile('token'), error => error.code === 'META_OAUTH_FAILED' && error.retryable === true)
  const network = createInstagramOAuthClient(config, { fetchImpl: async () => { throw new Error('socket') } })
  await assert.rejects(network.profile('token'), error => error.code === 'META_OAUTH_NETWORK' && error.retryable === true)
})

test('início OAuth bloqueia Pro e grava apenas hash do state para Premium', async () => {
  const created = []
  const db = { user: { findUnique: async ({ where }) => ({ plan: where.id, accessExpiresAt: null }) }, instagramOAuthState: { create: async args => created.push(args.data) } }
  await assert.rejects(beginInstagramOAuth('pro', instagramOAuthConfig(ENV), { db }), error => error.code === 'FEATURE_REQUIRES_PREMIUM')
  const result = await beginInstagramOAuth('premium', instagramOAuthConfig(ENV), { db })
  const state = new URL(result.url).searchParams.get('state')
  assert.ok(state)
  assert.notEqual(created[0].stateHash, state)
  assert.match(created[0].stateHash, /^[a-f0-9]{64}$/)
})

test('callback consome state uma vez e cria conexão e destino', async () => {
  const calls = []
  const now = new Date('2026-09-10T12:00:00Z')
  const tx = { instagramConnection: { upsert: async args => { calls.push(args); return { id: 'conn1' } } }, destination: { upsert: async args => calls.push(args) } }
  const db = {
    instagramOAuthState: { updateMany: async () => ({ count: 1 }), findUnique: async () => ({ userId: 'premium' }) },
    user: { findUnique: async () => ({ plan: 'premium', accessExpiresAt: null }) },
    $transaction: fn => fn(tx),
  }
  const client = { exchangeCode: async () => ({ access_token: 'short' }), exchangeLongLived: async () => ({ access_token: 'long', expires_in: 3600 }), profile: async () => ({ id: 'ig1', username: 'loja', account_type: 'BUSINESS' }) }
  const result = await completeInstagramOAuth({ code: 'code', state: 'state' }, instagramOAuthConfig(ENV), { db, client, now: () => now })
  assert.deepEqual(result, { connectionId: 'conn1', accountId: 'ig1', username: 'loja' })
  assert.equal(calls.length, 2)
  assert.equal(calls[1].create.type, 'instagram_story')
})
