import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DELIVERY_NETWORK,
  resolveDeliveryNetwork,
  isDeliveryNetworkEnabled,
  registerDeliveryNetwork,
  getDeliveryNetwork,
  __resetDeliveryNetworkRegistryForTests,
} from '../src/core/delivery/networks.js'
import { JID_KIND } from '../src/core/jid.js'

// Feature 017 (arquitetura multicanal) — Fase 2 Foundational.
//
// resolveDeliveryNetwork nunca pode devolver "desconhecido" ou lançar: um
// destino/origem gravado antes desta feature não tem `deliveryNetwork` na
// coluna, e precisa ser lido como WhatsApp em TODO caminho (FR-013/SC-003).
// Um valor inválido gravado por engano tem que cair no mesmo lugar seguro,
// nunca travar o worker.

test('resolveDeliveryNetwork: ausente cai em whatsapp', () => {
  assert.equal(resolveDeliveryNetwork(undefined), DELIVERY_NETWORK.WHATSAPP)
  assert.equal(resolveDeliveryNetwork(null), DELIVERY_NETWORK.WHATSAPP)
  assert.equal(resolveDeliveryNetwork(''), DELIVERY_NETWORK.WHATSAPP)
})

test('resolveDeliveryNetwork: valor desconhecido cai em whatsapp, nunca erro nem "desconhecido"', () => {
  assert.equal(resolveDeliveryNetwork('discord'), DELIVERY_NETWORK.WHATSAPP)
  assert.equal(resolveDeliveryNetwork(123), DELIVERY_NETWORK.WHATSAPP)
  assert.equal(resolveDeliveryNetwork({}), DELIVERY_NETWORK.WHATSAPP)
})

test('resolveDeliveryNetwork: valores conhecidos passam intactos', () => {
  assert.equal(resolveDeliveryNetwork('whatsapp'), DELIVERY_NETWORK.WHATSAPP)
  assert.equal(resolveDeliveryNetwork('telegram'), DELIVERY_NETWORK.TELEGRAM)
  assert.equal(resolveDeliveryNetwork('instagram'), DELIVERY_NETWORK.INSTAGRAM)
  // Tolerante a formatação (espaço/maiúscula) — mesma robustez de normalizePlan.
  assert.equal(resolveDeliveryNetwork(' Telegram '), DELIVERY_NETWORK.TELEGRAM)
})

test('valores de DELIVERY_NETWORK não colidem com Group.kind (group, channel)', () => {
  const kindValues = new Set(Object.values(JID_KIND))
  for (const value of Object.values(DELIVERY_NETWORK)) {
    assert.ok(!kindValues.has(value), `deliveryNetwork "${value}" colide com Group.kind`)
  }
})

test('isDeliveryNetworkEnabled: telegram é false no default (sem DELIVERY_NETWORKS_ENABLED)', () => {
  assert.equal(isDeliveryNetworkEnabled('telegram', {}), false)
  assert.equal(isDeliveryNetworkEnabled('instagram', {}), false)
})

test('isDeliveryNetworkEnabled: telegram é true só quando DELIVERY_NETWORKS_ENABLED inclui telegram', () => {
  assert.equal(isDeliveryNetworkEnabled('telegram', { DELIVERY_NETWORKS_ENABLED: 'whatsapp' }), false)
  assert.equal(isDeliveryNetworkEnabled('telegram', { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' }), true)
  assert.equal(isDeliveryNetworkEnabled('telegram', { DELIVERY_NETWORKS_ENABLED: 'telegram' }), true)
  // Tolerante a espaço e maiúscula em torno das vírgulas.
  assert.equal(isDeliveryNetworkEnabled('telegram', { DELIVERY_NETWORKS_ENABLED: ' whatsapp , Telegram ' }), true)
})

test('isDeliveryNetworkEnabled: whatsapp é sempre habilitado (nunca passa pelo interruptor)', () => {
  assert.equal(isDeliveryNetworkEnabled('whatsapp', {}), true)
  assert.equal(isDeliveryNetworkEnabled('whatsapp', { DELIVERY_NETWORKS_ENABLED: 'telegram' }), true)
})

test('resolveDeliveryNetwork nunca lança para nenhuma entrada exótica', () => {
  const exotic = [undefined, null, '', 0, NaN, [], {}, () => {}, Symbol('x'), '  ']
  for (const value of exotic) {
    assert.doesNotThrow(() => resolveDeliveryNetwork(value))
  }
})

test('registerDeliveryNetwork / getDeliveryNetwork: registro por injeção', (t) => {
  t.after(() => __resetDeliveryNetworkRegistryForTests())
  assert.equal(getDeliveryNetwork('fake'), null)
  const adapter = { id: 'fake', capabilities: {} }
  registerDeliveryNetwork(adapter)
  assert.equal(getDeliveryNetwork('fake'), adapter)
})
