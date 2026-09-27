import { JID_KIND } from '../core/jid.js'
import { canUseChannelButton, canUseChannels, canUseWatermark, canUseMultiNetwork } from './plans.js'
import { destinationImageModeWithoutWatermark, resolveDestinationImageMode } from '../core/imageModePolicy.js'
import { resolveDeliveryNetwork, isDeliveryNetworkEnabled, DELIVERY_NETWORK } from '../core/delivery/networks.js'

function isChannelGroup(group) {
  return group?.kind === JID_KIND.CHANNEL
}

function toMonitorGroup(group, targetPostJids = []) {
  return {
    id: group.id,
    waJid: group.waJid,
    kind: group.kind,
    // A estratégia de imagem (e a marca d'água) pertence ao DESTINO — ver
    // toPostDetail() abaixo e src/core/imageModePolicy.js. A origem NUNCA leu
    // `imageMode`; `Group.imageMode` continua na coluna de grupos role='monitor'
    // só por compatibilidade de schema, e não é propagado para cá de propósito.
    imageLinkTarget: group.imageLinkTarget ?? 'first',
    fallbackToOriginal: true,
    blockedKeywords: group.blockedKeywords,
    allowedPlatforms: group.allowedPlatforms,
    forwardMode: group.forwardMode,
    noLinkScope: group.noLinkScope,
    templateKey: group.templateKey ?? null,
    relayFooterText: group.relayFooterText ?? null,
    primaryLinkTarget: group.primaryLinkTarget ?? null,
    targetPostJids,
    // Intenção da cliente sobre os destinos (core/destinationRouting.js).
    // 'explicit' = ela escolheu; lista vazia então significa NENHUM destino.
    // Ausente/desconhecido cai em 'all' = comportamento histórico.
    targetsMode: group.targetsMode === 'explicit' ? 'explicit' : 'all',
    // Feature 017 (arquitetura multicanal de entrega): aplicativo por onde
    // esta origem lê. Ausente/desconhecido cai em 'whatsapp' — nunca
    // "desconhecido" (FR-013/SC-003). É este o ÚNICO ponto onde
    // `group.deliveryNetwork` vira config do worker (D-A4 do plano).
    deliveryNetwork: resolveDeliveryNetwork(group.deliveryNetwork),
  }
}

// Divisão Basic/PRO (2026-09-23): este é o chokepoint que o robô lê. Sem o
// plano, a marca d'água e o botão "Ver canal" saem daqui — mesmo que a coluna
// ainda guarde a escolha antiga (trial que venceu, conta que desceu para o
// Basic antes de `scripts/basic-sem-recursos-pro.mjs` rodar). Vale para todo
// caminho que parte do destino: espelhamento, fila, automáticas e agendadas.
function toPostDetail(group, { allowWatermark = true, allowChannelButton = true } = {}) {
  const imageMode = resolveDestinationImageMode(group.imageMode)
  return {
    waJid: group.waJid,
    kind: group.kind,
    welcomeMsg: group.welcomeMsg,
    channelButtonJid: allowChannelButton ? (group.channelButtonJid ?? null) : null,
    channelButtonName: allowChannelButton ? (group.channelButtonName ?? null) : null,
    // Modo de imagem e texto da marca são escolhidos POR DESTINO — cada grupo/
    // canal de postagem pode mostrar a mesma oferta de um jeito diferente. Ver
    // src/core/imageModePolicy.js (resolveDestinationImageMode cai em
    // 'original' para valor ausente/desconhecido, nunca deixa o worker sem
    // modo) e src/bot-worker.js (resolução por destino no loop de envio).
    imageMode: allowWatermark ? imageMode : destinationImageModeWithoutWatermark(imageMode),
    watermarkText: group.watermarkText ?? null,
    // 'white' | 'black'; nulo = padrão, resolvido no renderizador.
    watermarkColor: group.watermarkColor ?? null,
    // 'small' | 'medium' | 'large'; nulo = padrão ('medium'), resolvido no renderizador.
    watermarkSize: group.watermarkSize ?? null,
    // 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    // nulo = padrão ('center'), resolvido no renderizador.
    watermarkPosition: group.watermarkPosition ?? null,
    // Feature 017 (arquitetura multicanal de entrega): aplicativo por onde
    // este destino publica. Ausente/desconhecido cai em 'whatsapp' — nunca
    // "desconhecido" (FR-013/SC-003).
    deliveryNetwork: resolveDeliveryNetwork(group.deliveryNetwork),
  }
}

// Feature 017 (arquitetura multicanal de entrega), D-A4: um grupo/canal cuja
// rede de entrega NÃO é WhatsApp só entra na config do worker quando (1) o
// interruptor de rollout habilita aquela rede E (2) a conta tem direito de
// plano ao multicanal — as DUAS camadas de FR-047. Com o interruptor no
// default (`whatsapp`), esta função devolve `false` para qualquer grupo
// não-WhatsApp e o ramo de hand-off do worker (bot-worker.js) permanece
// inalcançável por construção, não por cuidado.
function isDeliveryNetworkVisible(group, { allowMultiNetwork, env }) {
  const network = resolveDeliveryNetwork(group.deliveryNetwork)
  if (network === DELIVERY_NETWORK.WHATSAPP) return true
  return isDeliveryNetworkEnabled(network, env) && allowMultiNetwork
}

export function buildEntitledGroupConfig({ groups = [], groupTargets = [], planSubject = {}, logger = null, env = process.env } = {}) {
  const allowChannels = canUseChannels(planSubject)
  const allowMultiNetwork = canUseMultiNetwork(planSubject)
  const postOptions = {
    allowWatermark: canUseWatermark(planSubject),
    allowChannelButton: canUseChannelButton(planSubject),
  }
  const visibleGroups = groups
    .filter(group => allowChannels || !isChannelGroup(group))
    .filter(group => isDeliveryNetworkVisible(group, { allowMultiNetwork, env }))
  const visiblePostJids = new Set(visibleGroups.filter(group => group.role === 'post').map(group => group.waJid))

  const targetsByMonitor = new Map()
  for (const target of groupTargets) {
    const postJid = target.post?.waJid
    if (!postJid || !visiblePostJids.has(postJid)) continue
    if (!targetsByMonitor.has(target.monitorId)) targetsByMonitor.set(target.monitorId, [])
    targetsByMonitor.get(target.monitorId).push(postJid)
  }

  const monitorGroups = visibleGroups.filter(group => group.role === 'monitor')
  const postGroups = visibleGroups.filter(group => group.role === 'post')
  const blockedChannelCount = allowChannels ? 0 : groups.filter(group => isChannelGroup(group)).length
  const blockedDeliveryNetworkCount = groups.filter(group => !isDeliveryNetworkVisible(group, { allowMultiNetwork, env })).length

  if (blockedChannelCount > 0) {
    logger?.warn?.({ blockedChannelCount }, 'Canais preservados foram removidos da config porque o plano atual não permite canais')
  }
  if (blockedDeliveryNetworkCount > 0) {
    logger?.warn?.({ blockedDeliveryNetworkCount }, 'Destinos/origens de outro aplicativo foram removidos da config (interruptor desligado ou plano sem direito ao multicanal)')
  }

  return {
    blockedChannelCount,
    groups: {
      monitor: monitorGroups.map(group => toMonitorGroup(group, targetsByMonitor.get(group.id) ?? [])),
      monitorJids: monitorGroups.map(group => group.waJid),
      post: postGroups.map(group => group.waJid),
      postDetails: postGroups.map(group => toPostDetail(group, postOptions)),
    },
  }
}
