import test from 'node:test'
import assert from 'node:assert/strict'

import { loadWaGroupsWithRecovery } from '../src/api/routes/session.js'

test('retoma processo do bot antes de carregar grupos quando a sessão persistida está conectada', async () => {
  const started = []
  const result = await loadWaGroupsWithRecovery('user-1', {
    isRunningFn: () => false,
    startBotFn: (userId) => started.push(userId),
    findResumableSessionFn: async () => ({ status: 'connected' }),
    listGroupsFn: async () => [{ waJid: '120363@g.us', name: 'Grupo VIP' }],
    sleepFn: async () => {},
  })

  assert.deepEqual(started, ['user-1'])
  assert.equal(result.recoveredProcess, true)
  assert.deepEqual(result.groups, [{ waJid: '120363@g.us', name: 'Grupo VIP' }])
})

test('mantém erro de bot parado quando não há sessão persistida retomável', async () => {
  await assert.rejects(
    loadWaGroupsWithRecovery('user-1', {
      isRunningFn: () => false,
      findResumableSessionFn: async () => null,
      listGroupsFn: async () => [],
      sleepFn: async () => {},
    }),
    /Bot não está rodando/,
  )
})

test('retorna erro retryable enquanto sessão retomada ainda reconecta ao WhatsApp', async () => {
  await assert.rejects(
    loadWaGroupsWithRecovery('user-1', {
      isRunningFn: () => false,
      startBotFn: () => {},
      findResumableSessionFn: async () => ({ status: 'connected' }),
      listGroupsFn: async () => { throw new Error('Bot não conectado') },
      timeoutMs: 0,
      sleepFn: async () => {},
    }),
    (err) => {
      assert.equal(err.code, 'WA_SESSION_RECOVERING')
      assert.equal(err.retryable, true)
      assert.match(err.message, /retomando sua conexão/)
      return true
    },
  )
})
