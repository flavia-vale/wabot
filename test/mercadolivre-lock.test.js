import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mercadoLivreCredentialLockKey, withMercadoLivreCredentialLock } from '../src/converters/mercadolivreCredentialLock.js'

test('mercadoLivreCredentialLockKey é estável por credencial e não expõe o ssid', () => {
  const creds = { tag: '475630078', ssid: 'ssid-super-secreto', csrf: 'csrf' }
  const key = mercadoLivreCredentialLockKey(creds)
  assert.equal(key, mercadoLivreCredentialLockKey({ ...creds }))
  assert.equal(key, mercadoLivreCredentialLockKey({ ...creds, tag: 'outra-tag' }))
  assert.equal(key.length, 24)
  assert.doesNotMatch(key, /ssid-super-secreto/)
})

test('withMercadoLivreCredentialLock serializa uso concorrente da mesma credencial', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wabot-ml-lock-test-'))
  try {
    const creds = { tag: '475630078', ssid: 'ssid-lock-test' }
    let release
    const first = withMercadoLivreCredentialLock(creds, async () => {
      await new Promise(resolve => { release = resolve })
      return 'first'
    }, { root, timeoutMs: 500, pollMs: 5, staleMs: 5_000 })

    await assert.rejects(
      () => withMercadoLivreCredentialLock(creds, async () => 'second', { root, timeoutMs: 25, pollMs: 5, staleMs: 5_000 }),
      err => err?.code === 'ML_AFFILIATE_LOCK_TIMEOUT',
    )

    release()
    assert.equal(await first, 'first')
    assert.equal(await withMercadoLivreCredentialLock(creds, async () => 'after-release', { root, timeoutMs: 100, pollMs: 5, staleMs: 5_000 }), 'after-release')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})


test('mercadoLivreCredentialLockKey usa ssid dentro do cookie e ignora csrf rotacionado', () => {
  const first = mercadoLivreCredentialLockKey({ cookie: 'ssid=sessao-ml; _csrf=csrf-antigo', tag: 'tag-a' })
  const second = mercadoLivreCredentialLockKey({ cookie: 'ssid=sessao-ml; _csrf=csrf-novo', tag: 'tag-b' })
  assert.equal(first, second)
})

// ---------------------------------------------------------------------------
// specs/006-ml-cookie-expiry-followup — T042 (Phase 7): credencial OAuth-only
// (sem ssid/id/cookie — cenário previsto para o eixo OAuth de getMlUserToken)
// não pode degenerar para a MESMA chave constante sha256('|') independente do
// usuário, senão o lock serializa o refresh OAuth de usuários DIFERENTES sob
// o mesmo mutex (contenção cross-user, risco de ML_AFFILIATE_LOCK_TIMEOUT).
// ---------------------------------------------------------------------------

test('mercadoLivreCredentialLockKey (OAuth-only, sem ssid/id/cookie): usuários diferentes geram chaves distintas', () => {
  const credsUserA = { userId: 'user-a', oauthAccessToken: 'token-a' }
  const credsUserB = { userId: 'user-b', oauthAccessToken: 'token-b' }

  const keyA = mercadoLivreCredentialLockKey(credsUserA)
  const keyB = mercadoLivreCredentialLockKey(credsUserB)

  assert.notEqual(keyA, keyB, 'credenciais OAuth-only de usuários diferentes não podem colidir no mesmo lock')
  assert.equal(keyA.length, 24)
  assert.equal(keyB.length, 24)
})

test('mercadoLivreCredentialLockKey (OAuth-only): mesmo userId gera a mesma chave (estável)', () => {
  const creds = { userId: 'user-estavel', oauthAccessToken: 'token-x' }
  assert.equal(mercadoLivreCredentialLockKey(creds), mercadoLivreCredentialLockKey({ ...creds, oauthAccessToken: 'token-y' }))
})

test('mercadoLivreCredentialLockKey (OAuth-only, sem userId): preserva o comportamento histórico degenerado (não quebra chamadores sem userId)', () => {
  // Sem ssid/id/cookie/userId não há nenhum jeito de diferenciar a
  // credencial — mantém o comportamento anterior (chave constante) em vez de
  // lançar ou inventar um identificador. Documenta a limitação residual.
  const key = mercadoLivreCredentialLockKey({ oauthAccessToken: 'token-sem-userid' })
  assert.equal(key, mercadoLivreCredentialLockKey({ oauthAccessToken: 'token-outro-sem-userid' }))
})

test('mercadoLivreCredentialLockKey: eixo afiliado (com id/ssid) NÃO é afetado pela presença de userId — compatibilidade com produção', () => {
  const withoutUserId = mercadoLivreCredentialLockKey({ id: 'cred-1', ssid: 'ssid-afiliado' })
  const withUserId = mercadoLivreCredentialLockKey({ id: 'cred-1', ssid: 'ssid-afiliado', userId: 'user-qualquer' })
  assert.equal(withoutUserId, withUserId, 'chave do eixo afiliado (id/ssid presentes) precisa ignorar userId para não mudar a chave já em produção')
})

test('mercadoLivreCredentialLockKey: eixo afiliado só com cookie (sem id) também ignora userId', () => {
  const withoutUserId = mercadoLivreCredentialLockKey({ cookie: 'ssid=sessao-ml' })
  const withUserId = mercadoLivreCredentialLockKey({ cookie: 'ssid=sessao-ml', userId: 'user-qualquer' })
  assert.equal(withoutUserId, withUserId)
})
