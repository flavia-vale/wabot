import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reloadWorkerConfig } from '../src/api/workerConfigReload.js'

// specs/017-client-coupon-catalog: reloadWorkerConfig foi extraído de
// src/api/routes/groups.js para src/api/workerConfigReload.js. Regressão do
// RCA 2026-08-26: sem `await` no reloadConfig a Promise ia crua para o
// logger e virava `configReloaded: {}` — parecia confirmação e não era.

test('reloadWorkerConfig usa await e devolve { ok: true, error: null } no sucesso', async () => {
  let called = false
  const result = await reloadWorkerConfig('user-1', {
    reloadConfig: async (userId) => {
      called = true
      assert.equal(userId, 'user-1')
      // Se reloadWorkerConfig não desse await aqui, o retorno abaixo
      // continuaria sendo uma Promise pendente no momento em que o `ok`
      // fosse calculado.
      await new Promise((resolve) => setTimeout(resolve, 5))
      return true
    },
  })
  assert.equal(called, true)
  assert.deepEqual(result, { ok: true, error: null })
})

test('reloadWorkerConfig devolve { ok: false, error: null } quando reloadConfig resolve falsy', async () => {
  const result = await reloadWorkerConfig('user-2', { reloadConfig: async () => false })
  assert.deepEqual(result, { ok: false, error: null })
})

test('reloadWorkerConfig nunca lança: reloadConfig que rejeita vira { ok: false, error: <mensagem> }', async () => {
  const result = await reloadWorkerConfig('user-3', {
    reloadConfig: async () => { throw new Error('supervisor fora do ar') },
  })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'supervisor fora do ar')
})

test('reloadWorkerConfig sem reloadConfig injetado usa o de manager.js sem lançar (ambiente de teste sem supervisor)', async () => {
  // Não injeta reloadConfig: cai no _reloadConfig real de manager.js. Em
  // ambiente de teste isso pode falhar (sem worker rodando) — o contrato é
  // que NUNCA lance, sempre devolva o formato { ok, error }.
  const result = await reloadWorkerConfig('user-sem-worker-nenhum')
  assert.equal(typeof result, 'object')
  assert.equal(typeof result.ok, 'boolean')
  assert.ok(result.error === null || typeof result.error === 'string')
})
