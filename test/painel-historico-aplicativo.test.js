import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deliveryNetworkLabel } from '../dashboard/lib/painel/logsCopy.js'

// Feature 017, T033 (FR-027): o histórico diz por qual aplicativo a oferta
// saiu. Linha antiga (sem deliveryNetwork) lê como WhatsApp — nunca
// "desconhecido".

test('linha antiga, sem aplicativo gravado, aparece como WhatsApp', () => {
  assert.equal(deliveryNetworkLabel({ deliveryNetwork: null }), 'WhatsApp')
  assert.equal(deliveryNetworkLabel({}), 'WhatsApp')
  assert.equal(deliveryNetworkLabel({ deliveryNetwork: 'algo-estranho' }), 'WhatsApp')
})

test('linha do Telegram aparece como Telegram', () => {
  assert.equal(deliveryNetworkLabel({ deliveryNetwork: 'telegram' }), 'Telegram')
  assert.equal(deliveryNetworkLabel({ deliveryNetwork: 'whatsapp' }), 'WhatsApp')
})

test('a tela de envios mostra o aplicativo no computador e no celular', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/envios/SendHistory.js', import.meta.url), 'utf8')
  assert.match(page, /<th>Aplicativo<\/th>/)
  assert.equal((page.match(/deliveryNetworkLabel\(log\)/g) || []).length, 2)
  assert.doesNotMatch(page, /desconhecido/i)
})
