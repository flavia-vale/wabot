import { test } from 'node:test'
import assert from 'node:assert/strict'

import { withSendTimeout } from '../src/sendMessageTimeout.js'

test('withSendTimeout resolve normalmente quando a promise termina antes do prazo', async () => {
  const result = await withSendTimeout(
    Promise.resolve('ok'),
    { timeoutMs: 1_000, destJid: 'x', route: 'primary' },
  )
  assert.equal(result, 'ok')
})

test('withSendTimeout rejeita com code=SEND_MESSAGE_TIMEOUT quando a promise nunca resolve', async () => {
  // Mimica sock.sendMessage travado. Resolvemos no fim do teste pra não
  // deixar promise pendurada (test runner trata como falha).
  let resolveLate
  const neverEnds = new Promise(resolve => { resolveLate = resolve })
  try {
    await assert.rejects(
      () => withSendTimeout(neverEnds, { timeoutMs: 20, destJid: 'destA', route: 'primary' }),
      err => {
        assert.equal(err.code, 'SEND_MESSAGE_TIMEOUT')
        assert.match(err.message, /sendMessage timeout/)
        assert.match(err.message, /destA/)
        return true
      },
    )
  } finally {
    resolveLate()
  }
})

test('withSendTimeout propaga erros reais da promise sem marcar como timeout', async () => {
  await assert.rejects(
    () => withSendTimeout(
      Promise.reject(new Error('connection closed')),
      { timeoutMs: 1_000, destJid: 'x', route: 'primary' },
    ),
    err => {
      assert.equal(err.message, 'connection closed')
      assert.notEqual(err.code, 'SEND_MESSAGE_TIMEOUT')
      return true
    },
  )
})

test('withSendTimeout limpa o timer após a promise resolver (não segura o event loop)', async () => {
  // Se o clearTimeout do .finally não rodasse, esse teste exigiria que o
  // processo esperasse 30s. Com a limpeza correta termina imediato.
  const start = Date.now()
  await withSendTimeout(
    Promise.resolve('done'),
    { timeoutMs: 30_000, destJid: 'x', route: 'primary' },
  )
  assert.ok(Date.now() - start < 1_000)
})
