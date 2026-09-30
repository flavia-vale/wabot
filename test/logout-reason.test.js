import test from 'node:test'
import assert from 'node:assert/strict'
import { describeLogoutReason } from '../src/core/logoutReason.js'

// 38 contas deslogadas (401) em 7 dias sem o motivo no registro. O Baileys
// traz o motivo na mensagem do erro e nos atributos do nó.
test('stream:error com conflict device_removed: mensagem e tipo do conflito', () => {
  const error = {
    message: 'Stream Errored (device_removed)',
    data: { tag: 'stream:error', attrs: { code: '401' }, content: [{ tag: 'conflict', attrs: { type: 'device_removed' } }] },
  }
  assert.deepEqual(describeLogoutReason(error), {
    message: 'Stream Errored (device_removed)',
    failureReason: '',
    conflictType: 'device_removed',
  })
})

test('failure: os atributos vêm direto em data', () => {
  const out = describeLogoutReason({ message: 'Connection Failure', data: { reason: '401', location: 'frc' } })
  assert.equal(out.message, 'Connection Failure')
  assert.equal(out.failureReason, '401')
  assert.equal(out.conflictType, '')
})

test('defensivo: erro vazio, sem data e textos enormes não quebram nem vazam o nó', () => {
  assert.deepEqual(describeLogoutReason(undefined), { message: '', failureReason: '', conflictType: '' })
  assert.deepEqual(describeLogoutReason({ message: 'x' }), { message: 'x', failureReason: '', conflictType: '' })
  const long = describeLogoutReason({ message: 'a'.repeat(500) })
  assert.ok(long.message.length <= 61, 'mensagem limitada')
  const out = describeLogoutReason({ message: 'm', data: { attrs: { reason: 'r', jid: '5511999999999@s.whatsapp.net' } } })
  assert.ok(!JSON.stringify(out).includes('5511'), 'identificadores do nó não entram no resultado')
})
