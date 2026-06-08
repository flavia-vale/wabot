import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isPrivateIpv4,
  isPrivateIpv6,
  isBlockedIp,
  isBlockedHostname,
  isSafePublicUrl,
  assertPublicUrl,
} from '../src/core/ssrfGuard.js'

test('isPrivateIpv4 reconhece faixas privadas, loopback e metadata', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
    assert.equal(isPrivateIpv4(ip), true, `${ip} deveria ser privado`)
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '54.207.0.1', '172.32.0.1']) {
    assert.equal(isPrivateIpv4(ip), false, `${ip} deveria ser público`)
  }
})

test('isPrivateIpv6 reconhece loopback, ULA, link-local e IPv4 mapeado', () => {
  for (const ip of ['::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateIpv6(ip), true, `${ip} deveria ser privado`)
  }
  assert.equal(isPrivateIpv6('2001:4860:4860::8888'), false)
})

test('isBlockedIp despacha por versão', () => {
  assert.equal(isBlockedIp('127.0.0.1'), true)
  assert.equal(isBlockedIp('::1'), true)
  assert.equal(isBlockedIp('8.8.8.8'), false)
  assert.equal(isBlockedIp('not-an-ip'), false)
})

test('isBlockedHostname bloqueia localhost, sufixos internos e IP literal privado', () => {
  for (const host of ['localhost', 'foo.local', 'service.internal', '127.0.0.1', '169.254.169.254', '[::1]', '']) {
    assert.equal(isBlockedHostname(host), true, `${host} deveria ser bloqueado`)
  }
  for (const host of ['amazon.com.br', 'www.mercadolivre.com.br', '8.8.8.8']) {
    assert.equal(isBlockedHostname(host), false, `${host} não deveria ser bloqueado`)
  }
})

test('isSafePublicUrl exige http(s) público', () => {
  assert.equal(isSafePublicUrl('https://www.amazon.com.br/dp/B09VQ39F41'), true)
  assert.equal(isSafePublicUrl('http://127.0.0.1:3001/metrics'), false)
  assert.equal(isSafePublicUrl('http://169.254.169.254/latest/meta-data/'), false)
  assert.equal(isSafePublicUrl('http://localhost/'), false)
  assert.equal(isSafePublicUrl('file:///etc/passwd'), false)
  assert.equal(isSafePublicUrl('javascript:alert(1)'), false)
  assert.equal(isSafePublicUrl('not a url'), false)
})

test('assertPublicUrl lança SSRF_BLOCKED para alvos internos sem depender de DNS', async () => {
  await assert.rejects(
    () => assertPublicUrl('http://169.254.169.254/latest/meta-data/'),
    err => err.code === 'SSRF_BLOCKED',
  )
  await assert.rejects(
    () => assertPublicUrl('http://127.0.0.1:6379'),
    err => err.code === 'SSRF_BLOCKED',
  )
  // Host público com DNS desabilitado passa (sem dependência de rede).
  assert.equal(await assertPublicUrl('https://www.amazon.com.br/dp/x', { resolveDns: false }), true)
})
