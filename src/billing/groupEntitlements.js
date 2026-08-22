import { JID_KIND } from '../core/jid.js'
import { canUseChannels } from './plans.js'
import { resolveGroupImageModeFor } from '../core/imageModePolicy.js'

function isChannelGroup(group) {
  return group?.kind === JID_KIND.CHANNEL
}

function toMonitorGroup(group, targetPostJids = []) {
  return {
    id: group.id,
    waJid: group.waJid,
    kind: group.kind,
    // ESCOLHA DE IMAGEM POR GRUPO — de volta na tela em 2026-08-22.
    //
    // Histórico curto: em 2026-07 (specs/001-image-mode-preview-default) o
    // seletor saiu da tela e este chokepoint passou a IGNORAR
    // `group.imageMode`, forçando um modo único. Em 2026-08-20/21 esse modo
    // único virou configurável por env (`GROUP_IMAGE_MODE`) porque o Mercado
    // Livre bloqueou o IP do servidor e o card de preview passou a sair sem
    // foto — era preciso trocar o formato de todo mundo em minutos.
    //
    // O que mudou agora: com a foto do ML vindo pela API e com o plano B em
    // cascata (core/previewImageFallbackPolicy.js), o card de preview deixou de
    // depender de UMA fonte de foto só — que era exatamente o motivo de a
    // escolha ter sido tirada da cliente. Então ela volta, restrita aos DOIS
    // formatos que mudam o que a pessoa vê no celular (preview/original).
    //
    // A invariante de rollback foi PRESERVADA, e essa parte não pode regredir:
    // `GROUP_IMAGE_MODE_FORCE` continua podendo ignorar a escolha de todo mundo
    // de uma vez, sem migration e sem redeploy. Toda a precedência vive em
    // `resolveGroupImageModeFor` (puro/testado); este continua sendo o único
    // ponto do pipeline de envio que decide o modo — não voltar a ler
    // `group.imageMode` cru em nenhum outro lugar.
    imageMode: resolveGroupImageModeFor(group),
    imageLinkTarget: group.imageLinkTarget ?? 'first',
    fallbackToOriginal: true,
    blockedKeywords: group.blockedKeywords,
    allowedPlatforms: group.allowedPlatforms,
    forwardMode: group.forwardMode,
    noLinkScope: group.noLinkScope,
    templateKey: group.templateKey ?? null,
    primaryLinkTarget: group.primaryLinkTarget ?? null,
    targetPostJids,
  }
}

function toPostDetail(group) {
  return {
    waJid: group.waJid,
    kind: group.kind,
    welcomeMsg: group.welcomeMsg,
    channelButtonJid: group.channelButtonJid ?? null,
    channelButtonName: group.channelButtonName ?? null,
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
