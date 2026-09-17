import { JID_KIND } from '../core/jid.js'
import { canUseChannels } from './plans.js'
import { resolveDestinationImageMode } from '../core/imageModePolicy.js'

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
    primaryLinkTarget: group.primaryLinkTarget ?? null,
    targetPostJids,
    // Intenção da cliente sobre os destinos (core/destinationRouting.js).
    // 'explicit' = ela escolheu; lista vazia então significa NENHUM destino.
    // Ausente/desconhecido cai em 'all' = comportamento histórico.
    targetsMode: group.targetsMode === 'explicit' ? 'explicit' : 'all',
  }
}

function toPostDetail(group) {
  return {
    waJid: group.waJid,
    kind: group.kind,
    welcomeMsg: group.welcomeMsg,
    channelButtonJid: group.channelButtonJid ?? null,
    channelButtonName: group.channelButtonName ?? null,
    // Modo de imagem e texto da marca são escolhidos POR DESTINO — cada grupo/
    // canal de postagem pode mostrar a mesma oferta de um jeito diferente. Ver
    // src/core/imageModePolicy.js (resolveDestinationImageMode cai em
    // 'original' para valor ausente/desconhecido, nunca deixa o worker sem
    // modo) e src/bot-worker.js (resolução por destino no loop de envio).
    imageMode: resolveDestinationImageMode(group.imageMode),
    watermarkText: group.watermarkText ?? null,
    // 'white' | 'black'; nulo = padrão, resolvido no renderizador.
    watermarkColor: group.watermarkColor ?? null,
    // 'small' | 'medium' | 'large'; nulo = padrão ('medium'), resolvido no renderizador.
    watermarkSize: group.watermarkSize ?? null,
    // 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    // nulo = padrão ('center'), resolvido no renderizador.
    watermarkPosition: group.watermarkPosition ?? null,
  }
}

export function buildEntitledGroupConfig({ groups = [], groupTargets = [], planSubject = {}, logger = null } = {}) {
  const allowChannels = canUseChannels(planSubject)
  const visibleGroups = allowChannels ? groups : groups.filter(group => !isChannelGroup(group))
  const visiblePostJids = new Set(visibleGroups.filter(group => group.role === 'post').map(group => group.waJid))

  const targetsByMonitor = new Map()
  for (const target of groupTargets) {
    const postJid = target.post?.waJid
    if (!postJid || (!allowChannels && !visiblePostJids.has(postJid))) continue
    if (!targetsByMonitor.has(target.monitorId)) targetsByMonitor.set(target.monitorId, [])
    targetsByMonitor.get(target.monitorId).push(postJid)
  }

  const monitorGroups = visibleGroups.filter(group => group.role === 'monitor')
  const postGroups = visibleGroups.filter(group => group.role === 'post')
  const blockedChannelCount = allowChannels ? 0 : groups.filter(group => isChannelGroup(group)).length

  if (blockedChannelCount > 0) {
    logger?.warn?.({ blockedChannelCount }, 'Canais preservados foram removidos da config porque o plano atual não permite canais')
  }

  return {
    blockedChannelCount,
    groups: {
      monitor: monitorGroups.map(group => toMonitorGroup(group, targetsByMonitor.get(group.id) ?? [])),
      monitorJids: monitorGroups.map(group => group.waJid),
      post: postGroups.map(group => group.waJid),
      postDetails: postGroups.map(toPostDetail),
    },
  }
}
