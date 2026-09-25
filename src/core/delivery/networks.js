// Feature 017 (arquitetura multicanal de entrega) — módulo PURO, sem banco e
// sem rede. É o único lugar do código onde é legítimo escrever a lista de
// redes de entrega ("aplicativo", na linguagem da cliente). Todo o resto do
// produto pergunta CAPACIDADE (caps.requiresImage, caps.acceptsButton,
// caps.canReadSource, caps.singleDestination...), nunca `if (rede === 'x')`
// — ver test/delivery-sem-if-por-rede.test.js e
// specs/017-multicanal-telegram-instagram/contracts/delivery-network-adapter.md.
//
// Vocabulário (AGENTS.md / spec.md): "canal"/`channel` já significa Canal do
// WhatsApp (`@newsletter`); "plataforma"/`platform` já significa LOJA. Por
// isso o termo aqui é `deliveryNetwork` — nunca reaproveitar os outros dois.

export const DELIVERY_NETWORK = Object.freeze({
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  INSTAGRAM: 'instagram',
})

const KNOWN_NETWORKS = new Set(Object.values(DELIVERY_NETWORK))

// Ausente ou desconhecido cai SEMPRE em whatsapp — nunca em erro, nunca em
// "desconhecido" (FR-013/SC-003). Todo destino/origem gravado antes desta
// feature não tem `deliveryNetwork` na coluna e precisa continuar sendo lido
// como WhatsApp, sem migração de dado nenhuma.
export function resolveDeliveryNetwork(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return KNOWN_NETWORKS.has(normalized) ? normalized : DELIVERY_NETWORK.WHATSAPP
}

// Registro por injeção (D-A1 do plano): é o que permite a rede fictícia de
// teste (T029) existir só em test/helpers/, sem que este arquivo precise
// conhecê-la, e é o que faz uma rede nova ser "apenas mais uma implementação
// registrada" (FR-031/US7).
const registry = new Map()

export function registerDeliveryNetwork(adapter) {
  if (!adapter || typeof adapter !== 'object' || !adapter.id) {
    throw new Error('registerDeliveryNetwork: adapter.id é obrigatório')
  }
  registry.set(adapter.id, adapter)
}

export function getDeliveryNetwork(id) {
  return registry.get(id) ?? null
}

// Só para teste: o registro é estado de módulo e os testes precisam de um
// estado limpo entre casos (mesmo padrão de __resetCacheForTests em plans.js).
export function __resetDeliveryNetworkRegistryForTests() {
  registry.clear()
}

// Declaração de capacidades por rede (FR-007, data-model.md §4.1). Nesta
// fatia só o WhatsApp tem entrada real — Telegram entra na Fatia 3 e
// Instagram permanece "declarado e indisponível" (FR-034) até a fase 2.
// `capabilities` é estático e puro: nenhuma chamada externa, é isso que
// permite a tela decidir o que oferecer sem nenhuma rede (FR-008).
export const CAPABILITIES = Object.freeze({
  [DELIVERY_NETWORK.WHATSAPP]: Object.freeze({
    id: DELIVERY_NETWORK.WHATSAPP,
    available: true,
    displayName: 'WhatsApp',
    acceptsText: true,
    acceptsImage: true,
    requiresImage: false,
    acceptsButton: true,
    acceptsClickableCard: true,
    acceptsVideo: true,
    acceptsWatermark: true,
    singleDestination: false,
    canReadSource: true,
    rateLimits: null,
  }),
})

export function getDeliveryNetworkCapabilities(id) {
  const normalized = resolveDeliveryNetwork(id)
  return CAPABILITIES[normalized] ?? CAPABILITIES[DELIVERY_NETWORK.WHATSAPP]
}

// Interruptor de rollout (D-A4 do plano). Lido SÓ fora do worker (na montagem
// da config, na API) — nenhum arquivo de código de worker pode ler esta env
// diretamente de `process.env` (ver test/delivery-rollout-fora-do-worker.test.js).
// Default: só whatsapp.
const DEFAULT_ENABLED_NETWORKS_ENV = DELIVERY_NETWORK.WHATSAPP

function parseEnabledDeliveryNetworks(env) {
  const raw = String(env?.DELIVERY_NETWORKS_ENABLED ?? DEFAULT_ENABLED_NETWORKS_ENV)
  return new Set(
    raw
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  )
}

// WhatsApp nunca passa por este interruptor: mesmo que alguém configure
// DELIVERY_NETWORKS_ENABLED sem "whatsapp" na lista, o WhatsApp continua
// habilitado — é a invariante de não-regressão (FR-010/FR-011) que não pode
// depender de ninguém lembrar de incluir "whatsapp" na env.
export function isDeliveryNetworkEnabled(id, env = process.env) {
  const normalized = resolveDeliveryNetwork(id)
  if (normalized === DELIVERY_NETWORK.WHATSAPP) return true
  return parseEnabledDeliveryNetworks(env).has(normalized)
}
