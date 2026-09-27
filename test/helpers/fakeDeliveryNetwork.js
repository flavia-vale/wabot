// Feature 017 (arquitetura multicanal de entrega), FR-032/US7: a rede
// FICTÍCIA de teste. Registrada SÓ em código de teste, NUNCA de produção —
// nenhum arquivo em src/ importa este módulo. Declara as QUATRO divergências
// que o Instagram vai trazer (contracts/delivery-network-adapter.md):
//
//   - singleDestination: true   (publicação num perfil, não conversa)
//   - requiresImage: true       (sem imagem não há publicação)
//   - acceptsButton: false      (não existe botão "Ver canal" fora do WhatsApp)
//   - canReadSource: false      (não sabe ler origem)
//
// É a prova executável de SC-009: origem → roteamento → conversão → texto →
// fila → ritmo → repetição → histórico rodam com ela sem tocar em nenhum
// arquivo de src/delivery/whatsapp/ nem de src/delivery/telegram/.

import { registerDeliveryNetwork, DELIVERY_NETWORK } from '../../src/core/delivery/networks.js'

export const FAKE_DELIVERY_NETWORK_ID = 'fake'

export const FAKE_CAPABILITIES = Object.freeze({
  id: FAKE_DELIVERY_NETWORK_ID,
  available: true,
  displayName: 'Rede Fictícia (teste)',
  acceptsText: true,
  acceptsImage: true,
  requiresImage: true,
  acceptsButton: false,
  acceptsClickableCard: false,
  acceptsVideo: false,
  acceptsWatermark: false,
  singleDestination: true,
  canReadSource: false,
  rateLimits: null,
})

// Estado em memória do que "chegou" na rede fictícia — só para o teste
// inspecionar o que teria sido publicado, sem nenhuma rede de verdade.
function createFakeDeliveryNetworkState() {
  const sent = []
  return {
    sent,
    reset() {
      sent.length = 0
    },
  }
}

/**
 * Registra a rede fictícia no registro por injeção (T029). Devolve o estado
 * (lista `sent`) para o teste inspecionar o que foi "publicado".
 */
export function registerFakeDeliveryNetwork() {
  const state = createFakeDeliveryNetworkState()

  const adapter = {
    id: FAKE_DELIVERY_NETWORK_ID,
    capabilities: FAKE_CAPABILITIES,
    describeDestination(destinationId) {
      return { nome: destinationId, identificadorExibido: destinationId }
    },
    isOwnDestination(destinationId) {
      return typeof destinationId === 'string' && destinationId.startsWith('fake:')
    },
    async readiness() {
      return { pronto: true, motivo: null, comoResolver: null }
    },
    async listDestinations() {
      // singleDestination: true — só existe UM destino possível (o "perfil").
      return [{ destinationId: 'fake:perfil', nome: 'Perfil de teste', pronto: true, motivo: null }]
    },
    async listSources() {
      // canReadSource: false — nunca deveria ser chamado; devolve vazio por
      // segurança, mas nenhuma tela pode nem oferecer isso (FR-008).
      return []
    },
    async send(ofertaNeutra, destino) {
      if (!ofertaNeutra?.imagem?.url) {
        return { ok: false, motivo: 'sem_imagem_disponivel' }
      }
      state.sent.push({ ofertaNeutra, destino })
      return { ok: true }
    },
  }

  registerDeliveryNetwork(adapter)
  return state
}

export { DELIVERY_NETWORK }
