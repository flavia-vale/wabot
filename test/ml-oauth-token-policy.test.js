import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOAuthRefreshDecision, applyOAuthTokenResponse } from '../src/converters/mlOAuthTokenPolicy.js'

test('buildOAuthRefreshDecision: reuse quando access token presente e ainda não expirou', () => {
  const now = 1_000_000
  const decision = buildOAuthRefreshDecision({
    oauthAccessToken: 'access-valid',
    oauthTokenExpiry: now + 60_000,
    oauthRefreshToken: 'refresh-1',
  }, now)
  assert.deepEqual(decision, { action: 'reuse', token: 'access-valid' })
})

test('buildOAuthRefreshDecision: refresh quando access token expirado e refresh presente', () => {
  const now = 1_000_000
  const decision = buildOAuthRefreshDecision({
    oauthAccessToken: 'access-expired',
    oauthTokenExpiry: now - 1000,
    oauthRefreshToken: 'refresh-1',
  }, now)
  assert.equal(decision.action, 'refresh')
})

test('buildOAuthRefreshDecision: refresh quando access token ausente e refresh presente', () => {
  const now = 1_000_000
  const decision = buildOAuthRefreshDecision({
    oauthRefreshToken: 'refresh-1',
  }, now)
  assert.equal(decision.action, 'refresh')
})

test('buildOAuthRefreshDecision: skip quando não há refresh token', () => {
  const now = 1_000_000
  const decision = buildOAuthRefreshDecision({}, now)
  assert.deepEqual(decision, { action: 'skip' })
})

test('applyOAuthTokenResponse: calcula oauthTokenExpiry com a margem de -300s', () => {
  const now = 1_000_000
  const patch = applyOAuthTokenResponse(
    { oauthRefreshToken: 'refresh-old' },
    { access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 21600 },
    now,
  )
  assert.equal(patch.oauthAccessToken, 'access-new')
  assert.equal(patch.oauthTokenExpiry, now + (21600 - 300) * 1000)
  assert.equal(patch.oauthRefreshToken, 'refresh-new')
})

test('applyOAuthTokenResponse: persiste o refresh_token novo quando presente na resposta', () => {
  const now = 1_000_000
  const patch = applyOAuthTokenResponse(
    { oauthRefreshToken: 'refresh-old' },
    { access_token: 'access-new', refresh_token: 'refresh-rotated', expires_in: 3600 },
    now,
  )
  assert.equal(patch.oauthRefreshToken, 'refresh-rotated')
  assert.notEqual(patch.oauthRefreshToken, 'refresh-old')
})

test('applyOAuthTokenResponse: mantém o refresh_token anterior quando a resposta não traz um novo (nunca apaga)', () => {
  const now = 1_000_000
  const patch = applyOAuthTokenResponse(
    { oauthRefreshToken: 'refresh-old' },
    { access_token: 'access-new', expires_in: 3600 },
    now,
  )
  assert.equal(patch.oauthRefreshToken, 'refresh-old')
})

test('applyOAuthTokenResponse: retorna null quando a resposta não tem access_token', () => {
  const now = 1_000_000
  const patch = applyOAuthTokenResponse(
    { oauthRefreshToken: 'refresh-old' },
    { error: 'invalid_grant' },
    now,
  )
  assert.equal(patch, null)
})

test('applyOAuthTokenResponse: idempotente — reaplicar a mesma resposta não regride os tokens', () => {
  const now = 1_000_000
  const prev = { oauthRefreshToken: 'refresh-old' }
  const tokenResponse = { access_token: 'access-new', refresh_token: 'refresh-rotated', expires_in: 3600 }
  const patch1 = applyOAuthTokenResponse(prev, tokenResponse, now)
  const patch2 = applyOAuthTokenResponse(prev, tokenResponse, now)
  assert.deepEqual(patch1, patch2)
})
