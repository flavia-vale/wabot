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

// Declaração de capacidades por rede (FR-007, data-model.md §4.1). O
// Instagram não tem entrada: o Stories dele segue o caminho próprio em
// src/instagram/ (decisão T001, 2026-10-02).
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
  // Fatia 3 (T044/T065). Limites de ritmo: estimativas PÚBLICAS da
  // documentação do Telegram (~30 mensagens/s no robô inteiro, ~20 por
  // minuto por grupo) — não são medição própria; calibrar em homologação (Q6).
  [DELIVERY_NETWORK.TELEGRAM]: Object.freeze({
    id: DELIVERY_NETWORK.TELEGRAM,
    available: true,
    displayName: 'Telegram',
    acceptsText: true,
    acceptsImage: true,
    requiresImage: false,
    acceptsButton: false,
    acceptsClickableCard: false,
    acceptsVideo: true,
    acceptsWatermark: true,
    singleDestination: false,
    canReadSource: true,
    rateLimits: Object.freeze({
      globalPerSecond: 25,
      perDestinationPerMinute: 18,
    }),
  }),
})

// Teto de entregas por conta em cada passada da caixa de saída (rodízio —
// uma conta em volume alto não toma a vez das outras, FR-039).
export function resolveFairSharePerUser(env = process.env) {
  const n = Number.parseInt(String(env?.DELIVERY_FAIR_SHARE_PER_USER ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 5
}

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

// Nome de cada aplicativo como a cliente lê na tela. Diferente de
// CAPABILITIES (que só declara rede que ENTREGA por este caminho), aqui entra
// toda rede conhecida — o histórico precisa dar nome a qualquer linha, e o
// nulo/desconhecido de linha antiga lê como WhatsApp (FR-027), nunca
// "desconhecido".
const DISPLAY_NAMES = Object.freeze({
  [DELIVERY_NETWORK.WHATSAPP]: 'WhatsApp',
  [DELIVERY_NETWORK.TELEGRAM]: 'Telegram',
  [DELIVERY_NETWORK.INSTAGRAM]: 'Instagram',
})

export function deliveryNetworkDisplayName(value) {
  return DISPLAY_NAMES[resolveDeliveryNetwork(value)]
}

// Situação de cada aplicativo na lista que a cliente vê (FR-034/US9):
// - `disponivel`: entrega por este caminho e está ligado no servidor;
// - `em_breve`: ainda não entrega (rede declarada, interruptor desligado ou
//   capacidade ainda não declarada) — aparece, mas não pode ser escolhido;
// - `tela_propria`: o Instagram Stories já funciona por um caminho próprio
//   (src/instagram/, decisão T001 de 2026-10-02: fica como está). Aparece
//   para a cliente saber que existe, mas é configurado na tela dele.
// O direito de plano NUNCA tira um aplicativo da lista — só decide se ele
// pode ser usado (`liberadoNoPlano`), para a cliente ver que o recurso existe.
export const DELIVERY_NETWORK_STATUS = Object.freeze({
  DISPONIVEL: 'disponivel',
  EM_BREVE: 'em_breve',
  TELA_PROPRIA: 'tela_propria',
})

const SEPARATE_PATH_NETWORKS = new Set([DELIVERY_NETWORK.INSTAGRAM])

export function listDeliveryNetworksForAccount({ allowMultiNetwork = false, env = process.env } = {}) {
  return Object.values(DELIVERY_NETWORK).map((id) => {
    const caps = CAPABILITIES[id] ?? null
    let status = DELIVERY_NETWORK_STATUS.EM_BREVE
    if (SEPARATE_PATH_NETWORKS.has(id)) status = DELIVERY_NETWORK_STATUS.TELA_PROPRIA
    else if (caps?.available && isDeliveryNetworkEnabled(id, env)) status = DELIVERY_NETWORK_STATUS.DISPONIVEL
    const isWhatsapp = id === DELIVERY_NETWORK.WHATSAPP
    return {
      id,
      displayName: DISPLAY_NAMES[id],
      status,
      selecionavel: status === DELIVERY_NETWORK_STATUS.DISPONIVEL && (isWhatsapp || allowMultiNetwork),
      liberadoNoPlano: isWhatsapp || allowMultiNetwork,
      capacidades: caps
        ? {
            aceitaBotao: caps.acceptsButton,
            exigeImagem: caps.requiresImage,
            aceitaVideo: caps.acceptsVideo,
            aceitaMarcaDagua: caps.acceptsWatermark,
            destinoUnico: caps.singleDestination,
            leOrigem: caps.canReadSource,
          }
        : null,
    }
  })
}

// Prefixo do identificador de destino/origem de cada aplicativo que não é
// WhatsApp (R10). Endereço do WhatsApp nunca começa assim, então a decisão
// "por qual aplicativo sai" vem do próprio identificador gravado.
const DESTINATION_PREFIXES = Object.freeze([
  [DELIVERY_NETWORK.TELEGRAM, 'tg:'],
])

export function deliveryNetworkOfDestinationId(destinationId) {
  const value = String(destinationId ?? '')
  for (const [network, prefix] of DESTINATION_PREFIXES) {
    if (value.startsWith(prefix)) return network
  }
  return DELIVERY_NETWORK.WHATSAPP
}
