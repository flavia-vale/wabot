import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSendCountdown } from '../src/domain/painel/sendCountdown.js'

test('contagem regressiva mostra minutos e segundos até o envio', () => {
  const now = Date.parse('2026-09-28T12:00:00Z')
  assert.equal(formatSendCountdown('2026-09-28T12:04:32Z', now), 'sai em 4:32')
  assert.equal(formatSendCountdown('2026-09-28T12:00:00Z', now), 'sai agora')
})

