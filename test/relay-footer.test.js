import test from 'node:test'
import assert from 'node:assert/strict'

import { appendRelayFooter, normalizeRelayFooter, RELAY_FOOTER_MAX_CHARS } from '../src/core/relayFooter.js'

test('appendRelayFooter separa o complemento do texto convertido por uma linha em branco', () => {
  assert.equal(
    appendRelayFooter('Oferta com https://link.convertido\n', '  Entre no grupo VIP!  '),
    'Oferta com https://link.convertido\n\nEntre no grupo VIP!',
  )
})

test('appendRelayFooter mantém a mensagem intacta quando o complemento está vazio', () => {
  assert.equal(appendRelayFooter('Oferta original\n', '   '), 'Oferta original\n')
  assert.equal(normalizeRelayFooter('linha 1\r\nlinha 2'), 'linha 1\nlinha 2')
  assert.equal(RELAY_FOOTER_MAX_CHARS, 1000)
})
