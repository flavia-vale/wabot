import assert from 'node:assert/strict'
import test from 'node:test'

import { buildErrorsByMessage, normalizeAdminErrorGroupKey } from '../src/adminLogSummary.js'

test('buildErrorsByMessage agrupa erros por mensagem normalizada e ordena por volume', () => {
  const logs = [
    { status: 'error', errorMsg: 'timeout:incoming', sentAt: new Date('2026-06-28T10:00:00Z') },
    { status: 'error', errorMsg: 'timeout:incoming', sentAt: new Date('2026-06-28T11:00:00Z') },
    { status: 'skipped', errorMsg: 'skip:title_mismatch', sentAt: new Date('2026-06-28T09:00:00Z') },
    { status: 'error', errorMsg: 'timeout:send:120363@g.us', sentAt: new Date('2026-06-28T12:00:00Z') },
    { status: 'error', errorMsg: 'timeout:send:999999@g.us', sentAt: new Date('2026-06-28T13:00:00Z') },
    { status: 'success', errorMsg: 'error:other:nao-conta', sentAt: new Date('2026-06-28T14:00:00Z') },
    { status: 'queued', errorMsg: 'error:queue_full', sentAt: new Date('2026-06-28T15:00:00Z') },
  ]

  const result = buildErrorsByMessage(logs)

  assert.equal(result[0].errorMsg, 'timeout:send:*')
  assert.equal(result[0].count, 2)
  assert.equal(result[0].sampleErrorMsg, null)
  assert.deepEqual(result[0].statusBreakdown, { error: 2 })
  assert.equal(result[1].errorMsg, 'timeout:incoming')
  assert.equal(result[1].count, 2)
  assert.equal(result[2].errorMsg, 'skip:title_mismatch')
  assert.equal(result[2].count, 1)
  assert.equal(result.length, 3)
})

test('normalizeAdminErrorGroupKey remove detalhes variáveis e preserva erros estáveis', () => {
  assert.equal(normalizeAdminErrorGroupKey('timeout:send:abc@g.us'), 'timeout:send:*')
  assert.equal(normalizeAdminErrorGroupKey('error:conversion:Sem credenciais Amazon'), 'error:conversion:*')
  assert.equal(normalizeAdminErrorGroupKey('skip:incoming_error:Bad MAC'), 'skip:incoming_error:*')
  assert.equal(normalizeAdminErrorGroupKey('error:baileys:403'), 'error:baileys:403')
  assert.equal(normalizeAdminErrorGroupKey(''), 'unknown')
})
