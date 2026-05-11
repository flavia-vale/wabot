import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createCorsOriginChecker,
  getAllowedOrigins,
  isIpHost,
  isStrictProductionRuntime,
  normalizeOrigin,
} from '../src/api/cors.js'

test('normaliza somente origins HTTP/HTTPS canônicas', () => {
  assert.equal(normalizeOrigin(' http://178.105.54.0:3006/login?x=1 '), 'http://178.105.54.0:3006')
  assert.equal(normalizeOrigin('https://ESPelhagrupos.com.br/path'), 'https://espelhagrupos.com.br')
  assert.equal(normalizeOrigin('ftp://espelhagrupos.com.br'), null)
  assert.equal(normalizeOrigin('não-é-url'), null)
})

test('identifica hosts por IP reais sem aceitar IPv4 inválido', () => {
  assert.equal(isIpHost('178.105.54.0'), true)
  assert.equal(isIpHost('127.0.0.1'), true)
  assert.equal(isIpHost('::1'), true)
  assert.equal(isIpHost('999.999.999.999'), false)
  assert.equal(isIpHost('espelhagrupos.com.br'), false)
})

test('porta oficial da API mantém bloqueio estrito mesmo com ambiente declarado como staging', () => {
  assert.equal(isStrictProductionRuntime({ NODE_ENV: 'production', API_PORT: '3001', APP_ENV: 'staging' }), true)
})

test('mantém IP de staging mesmo com NODE_ENV production na API 3004', () => {
  const allowed = getAllowedOrigins({
    NODE_ENV: 'production',
    API_PORT: '3004',
    CORS_ORIGINS: ' http://178.105.54.0:3006/login , https://example.com/app ',
  })

  assert.equal(isStrictProductionRuntime({ NODE_ENV: 'production', API_PORT: '3004' }), false)
  assert.ok(allowed.includes('http://178.105.54.0:3006'))
  assert.ok(allowed.includes('https://example.com'))
})

test('remove origins por IP no runtime estrito de produção', () => {
  const allowed = getAllowedOrigins({
    NODE_ENV: 'production',
    API_PORT: '3001',
    CORS_ORIGINS: 'http://178.105.54.0:3006, http://192.168.0.10:3000, https://example.com',
  })

  assert.equal(isStrictProductionRuntime({ NODE_ENV: 'production', API_PORT: '3001' }), true)
  assert.ok(!allowed.includes('http://178.105.54.0:3006'))
  assert.ok(!allowed.includes('http://192.168.0.10:3000'))
  assert.ok(allowed.includes('https://example.com'))
  assert.ok(allowed.includes('https://espelhagrupos.com.br'))
})

test('declaração explícita de produção mantém bloqueio de IP mesmo fora da porta 3001', () => {
  const allowed = getAllowedOrigins({
    NODE_ENV: 'production',
    API_PORT: '3004',
    APP_ENV: 'production',
    CORS_ORIGINS: 'http://178.105.54.0:3006, https://example.com',
  })

  assert.equal(isStrictProductionRuntime({ NODE_ENV: 'production', API_PORT: '3004', APP_ENV: 'production' }), true)
  assert.ok(!allowed.includes('http://178.105.54.0:3006'))
  assert.ok(allowed.includes('https://example.com'))
})

test('checker de CORS compara origin normalizada e rejeita origins malformadas', () => {
  const isAllowed = createCorsOriginChecker(['http://178.105.54.0:3006'])

  assert.equal(isAllowed(undefined), true)
  assert.equal(isAllowed('http://178.105.54.0:3006/login'), true)
  assert.equal(isAllowed('http://178.105.54.0:3007'), false)
  assert.equal(isAllowed('não-é-url'), false)
})
