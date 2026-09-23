// RCA 2026-09-23 — auditoria de segurança. Três brechas medidas/confirmadas:
// IP do visitante falsificável por X-Forwarded-For, e-mail de dona do admin
// gravável por autoatendimento e filtro de SSRF que aceitava IPv4 escondido
// dentro de IPv6.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Fastify from 'fastify'
import { TRUSTED_PROXIES } from '../src/api/trustedProxies.js'
import { isReservedAdminEmail, DEFAULT_OWNER_ADMIN_EMAILS } from '../src/auth/reservedAdminEmails.js'
import { isSafePublicUrl, isPrivateIpv6 } from '../src/core/ssrfGuard.js'

async function ipFor({ remoteAddress, xff }) {
  const app = Fastify({ trustProxy: TRUSTED_PROXIES })
  app.get('/ip', (req) => ({ ip: req.ip }))
  const res = await app.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress,
    headers: xff ? { 'x-forwarded-for': xff } : {},
  })
  await app.close()
  return res.json().ip
}

test('pedido pela Cloudflare: vale o IP real, nunca o que o visitante inventou', async () => {
  // "<inventado>, <real acrescentado pela Cloudflare>, <borda da Cloudflare acrescentada pelo nginx>"
  assert.equal(await ipFor({ remoteAddress: '127.0.0.1', xff: '203.0.113.9, 198.51.100.7, 172.70.1.1' }), '198.51.100.7')
  // nginx que repassa sem acrescentar a borda
  assert.equal(await ipFor({ remoteAddress: '127.0.0.1', xff: '203.0.113.9, 198.51.100.7' }), '198.51.100.7')
})

test('X-Forwarded-For: 127.0.0.1 não abre o que é só da própria máquina', async () => {
  assert.equal(await ipFor({ remoteAddress: '127.0.0.1', xff: '127.0.0.1, 198.51.100.7, 162.158.4.4' }), '198.51.100.7')
})

test('quem fala direto com a origem é identificado pelo próprio IP', async () => {
  assert.equal(await ipFor({ remoteAddress: '203.0.113.50', xff: '1.2.3.4' }), '203.0.113.50')
  assert.equal(await ipFor({ remoteAddress: '203.0.113.50', xff: '173.245.48.1' }), '203.0.113.50')
})

test('chamada local sem cabeçalho continua sendo local (scraper do /metrics)', async () => {
  assert.equal(await ipFor({ remoteAddress: '127.0.0.1' }), '127.0.0.1')
})

test('a API não volta a confiar na cadeia inteira', () => {
  const server = readFileSync(new URL('../src/api/server.js', import.meta.url), 'utf8')
  assert.doesNotMatch(server, /trustProxy:\s*true/)
  assert.match(server, /trustProxy:\s*TRUSTED_PROXIES/)
})

test('e-mails de dona do admin são reservados (inclui ADMIN_EMAILS)', () => {
  for (const email of DEFAULT_OWNER_ADMIN_EMAILS) {
    assert.equal(isReservedAdminEmail(email, {}), true)
    assert.equal(isReservedAdminEmail(`  ${email.toUpperCase()} `, {}), true)
  }
  assert.equal(isReservedAdminEmail('cliente@gmail.com', {}), false)
  assert.equal(isReservedAdminEmail('', {}), false)
  assert.equal(isReservedAdminEmail('extra@x.com', { ADMIN_EMAILS: 'a@x.com, Extra@X.com' }), true)
})

test('cadastro e troca de e-mail conferem a reserva; o admin lê a MESMA lista', () => {
  const auth = readFileSync(new URL('../src/api/routes/auth.js', import.meta.url), 'utf8')
  const admin = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const register = auth.slice(auth.indexOf("'/register'"), auth.indexOf("'/login'"))
  const changeEmail = auth.slice(auth.indexOf("'/me/email'"))
  assert.match(register, /isReservedAdminEmail\(email\)/)
  assert.match(changeEmail.slice(0, 2000), /isReservedAdminEmail\(email\)/)
  assert.match(admin, /DEFAULT_BOOTSTRAP_ADMIN_EMAILS = DEFAULT_OWNER_ADMIN_EMAILS/)
  assert.doesNotMatch(admin, /DEFAULT_BOOTSTRAP_ADMIN_EMAILS = \[/)
})

test('SSRF: IPv4 interno escondido em IPv6 é recusado', () => {
  for (const url of [
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:a9fe:a9fe]/latest/meta-data',
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://[::7f00:1]/',
    'http://[fec0::1]/',
    'http://198.18.0.1/',
  ]) {
    assert.equal(isSafePublicUrl(url), false, url)
  }
  assert.equal(isPrivateIpv6('::ffff:7f00:1'), true)
  assert.equal(isSafePublicUrl('http://[::ffff:808:808]/'), true) // 8.8.8.8
  assert.equal(isSafePublicUrl('http://[2001:4860:4860::8888]/'), true)
})
