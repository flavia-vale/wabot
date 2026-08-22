import { JID_KIND } from '../core/jid.js'
import { canUseChannels } from './plans.js'
import { resolveGroupImageMode } from '../core/imageModePolicy.js'

function isChannelGroup(group) {
  return group?.kind === JID_KIND.CHANNEL
}

function toMonitorGroup(group, targetPostJids = []) {
  return {
    id: group.id,
    waJid: group.waJid,
    kind: group.kind,
    // CHOKEPOINT: o valor persistido em `Group.imageMode` é IGNORADO. O modo é
    // único para todo mundo e vem da env global (`GROUP_IMAGE_MODE`, padrão
    // `original` = "a foto que veio na oferta").
    //
    // A escolha por grupo chegou a voltar à tela em 2026-08-22 e foi retirada
    // no mesmo dia: com ela ligada em produção apareceu divergência entre o que
    // o painel mostrava e o que saía no grupo, e a prioridade passou a ser
    // manter as clientes funcionando. Não reintroduzir a leitura de
    // `group.imageMode` aqui sem antes fechar aquela investigação.
    imageMode: resolveGroupImageMode(),
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
