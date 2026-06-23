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
