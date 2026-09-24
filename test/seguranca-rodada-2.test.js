// Auditoria de segurança 2026-09-23 — segunda rodada de correções.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { Agent } from 'undici'
import { isAdminMfaVerified, hasConfiguredStepUpMfa, safeEqualString } from '../src/api/adminMfa.js'
import { passwordVersion, createSessionVersionCache, isLoginToken } from '../src/auth/sessionVersion.js'
import { createGuardedConnector, createSafeLookup, isEgressGuardEnabled } from '../src/api/egressGuard.js'
import { resolveAdminAccess } from '../src/api/routes/admin.js'
import { PRIMARY_OWNER_ADMIN_EMAIL } from '../src/auth/reservedAdminEmails.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const req = (token) => ({ headers: token === undefined ? {} : { 'x-admin-mfa-token': token } })

test('segunda senha do admin: desligada sem token; com token exige o valor exato', () => {
  assert.equal(isAdminMfaVerified(req(), {}), true)
  assert.equal(isAdminMfaVerified(req('x'), { ADMIN_MFA_TOKEN: 'segredo' }), false)
  assert.equal(isAdminMfaVerified(req(), { ADMIN_MFA_TOKEN: 'segredo' }), false)
  assert.equal(isAdminMfaVerified(req(' segredo '), { ADMIN_MFA_TOKEN: 'segredo' }), true)
  // Reprocessamento financeiro: sem token configurado, recusa.
  assert.equal(hasConfiguredStepUpMfa(req('qualquer'), {}), false)
  assert.equal(hasConfiguredStepUpMfa(req('segredo'), { ADMIN_MFA_TOKEN: 'segredo' }), true)
  assert.equal(safeEqualString('', ''), false)
})

test('segunda senha cobre e-mails em massa e afiliados; ninguém compara com ===', () => {
  for (const file of ['../src/api/routes/adminEmails.js', '../src/api/routes/affiliate.js']) {
    assert.match(read(file), /permission\.endsWith\(':write'\) && !isAdminMfaVerified\(req\)/, file)
  }
  for (const file of ['../src/api/routes/admin.js', '../src/api/routes/payments.js']) {
    assert.doesNotMatch(read(file), /providedToken === configuredToken/, file)
  }
  assert.doesNotMatch(read('../src/api/routes/payments.js'), /return expected === v1/)
})

test('dona principal é sempre dona, mesmo com registro de admin rebaixado ou desativado', () => {
  assert.equal(PRIMARY_OWNER_ADMIN_EMAIL, 'flavia.vale@usp.br')
  for (const adminUser of [null, { id: 'a', role: 'viewer', status: 'active' }, { id: 'a', role: 'owner', status: 'disabled' }]) {
    assert.equal(resolveAdminAccess({ email: 'Flavia.Vale@usp.br', status: 'active', adminUser }).role, 'owner')
  }
  // As outras seguem a regra de antes: registro ativo manda.
  assert.equal(resolveAdminAccess({ email: 'tacianeaas02@gmail.com', status: 'active', adminUser: { id: 'b', role: 'viewer', status: 'active' } }).role, 'viewer')
  assert.equal(resolveAdminAccess({ email: 'cliente@gmail.com', status: 'active', adminUser: null }).role, null)
})

test('trocar a senha derruba os logins antigos; token sem versão segue valendo até vencer', async () => {
  let hash = '$2b$10$antigo'
  const cache = createSessionVersionCache({ loadPasswordHash: async () => hash, ttlMs: 60_000 })
  const tokenAntigo = passwordVersion(hash)
  assert.equal(await cache.matches('u1', tokenAntigo), true)
  hash = '$2b$10$novo'
  cache.invalidate('u1')
  assert.equal(await cache.matches('u1', tokenAntigo), false)
  assert.equal(await cache.matches('u1', passwordVersion(hash)), true)
  assert.equal(await cache.matches('u1', undefined), true)
})

test('ticket do QR e state do OAuth não passam como login', () => {
  assert.equal(isLoginToken({ sub: 'u1', jti: 'x' }), true)
  assert.equal(isLoginToken({ sub: 'u1', purpose: 'qr_ws' }), false)
  assert.equal(isLoginToken({ userId: 'u1', p: 'ml_oauth' }), false)
})

test('todo token de login novo carrega a versão da senha, e a troca invalida o cache', () => {
  const auth = read('../src/api/routes/auth.js')
  const signs = auth.match(/app\.jwt\.sign\(\{ sub: [^}]*\}/g) ?? []
  assert.equal(signs.length, 4)
  for (const sign of signs) assert.match(sign, /pv: passwordVersion\(/)
  assert.equal((auth.match(/app\.invalidateSessionVersion\?\.\(/g) ?? []).length, 2)
  const server = read('../src/api/server.js')
  assert.match(server, /if \(!isLoginToken\(user\)\) continue/)
  assert.match(server, /sessionVersions\.matches\(user\.sub, user\.pv\)/)
})

test('trava de saída: DNS que aponta para dentro é recusado', async () => {
  const fakeLookup = (answer) => (_host, _opts, cb) => cb(null, answer)
  const lookupInterno = createSafeLookup(fakeLookup([{ address: '169.254.169.254', family: 4 }]))
  await new Promise((resolve) => lookupInterno('evil.example', {}, (err) => {
    assert.equal(err?.code, 'SSRF_BLOCKED')
    resolve()
  }))
  const lookupPublico = createSafeLookup(fakeLookup([{ address: '93.184.216.34', family: 4 }]))
  await new Promise((resolve) => lookupPublico('example.com', {}, (err, address) => {
    assert.equal(err, null)
    assert.equal(address, '93.184.216.34')
    resolve()
  }))
})

test('trava de saída: fetch para servidor local (IP ou nome) não conecta', async () => {
  let hits = 0
  const server = http.createServer((_req, res) => { hits += 1; res.end('segredo interno') })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const dispatcher = new Agent({ connect: createGuardedConnector() })
  try {
    for (const url of [`http://127.0.0.1:${port}/`, `http://localhost:${port}/`, `http://[::ffff:7f00:1]:${port}/`]) {
      await assert.rejects(fetch(url, { dispatcher }), url)
    }
    assert.equal(hits, 0)
  } finally {
    await dispatcher.close()
    server.close()
  }
  assert.equal(isEgressGuardEnabled({}), true)
  assert.equal(isEgressGuardEnabled({ EGRESS_GUARD: 'off' }), false)
  assert.match(read('../src/api/server.js'), /installEgressGuard\(\{ log: app\.log \}\)/)
})

test('pagamento: o dono vem só do Mercado Pago; recover exige dono e id numérico; health só admin', () => {
  const payments = read('../src/api/routes/payments.js')
  assert.match(payments, /const userId = snapshot\.externalReference \?\? null/)
  assert.doesNotMatch(payments, /snapshot\.externalReference \?\? external_reference/)
  assert.match(payments, /if \(!mpUserRef\) \{/)
  assert.match(payments, /INVALID_PAYMENT_ID/)
  const health = payments.slice(payments.indexOf("app.get('/health'"))
  assert.match(health.slice(0, 800), /resolveAdminAccess\(viewer\)\.role/)
})

test('erro nosso (5xx) não devolve a mensagem interna', () => {
  const server = read('../src/api/server.js')
  assert.match(server, /if \(status >= 500\) \{\n\s+const safeError = new Error\('Erro interno/)
  assert.doesNotMatch(read('../src/api/routes/clickTracker.js'), /send\(\{ error: err\.message \}\)/)
})

test('painel não grava mais o token no navegador; deploy não deixa token no servidor', () => {
  const api = read('../dashboard/lib/api.js')
  assert.doesNotMatch(api, /localStorage\.setItem\(AUTH_TOKEN_KEY/)
  const workflow = read('../.github/workflows/deploy.yml')
  assert.equal((workflow.match(/trap 'git remote set-url origin "https:\/\/github\.com\//g) ?? []).length, 2)
  assert.match(read('../dashboard/next.config.mjs'), /poweredByHeader: false/)
})
