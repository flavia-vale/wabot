import test from 'node:test'
import assert from 'node:assert/strict'
import { composeRelayFooter, relayFooterControls, resolveRelayFooterVariables } from '../src/core/relayFooter.js'

test('controles preservam texto antigo e permitem adicionar link do grupo', () => {
  const value = composeRelayFooter({ includeCustomText: true, customText: 'Entre no VIP', includeGroupLink: true })
  assert.equal(value, 'Entre no VIP\n\n{{grupoLink}}')
  assert.deepEqual(relayFooterControls(value), { includeGroupLink: true, includeCustomText: true, customText: 'Entre no VIP' })
})

test('variável do rodapé vira link configurado antes do envio', () => {
  assert.equal(resolveRelayFooterVariables('Veja o grupo\n{{grupoLink}}', { groupLink: 'https://chat.whatsapp.com/x' }), 'Veja o grupo\nhttps://chat.whatsapp.com/x')
})
