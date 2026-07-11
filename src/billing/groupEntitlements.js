import { JID_KIND } from '../core/jid.js'
import { canUseChannels } from './plans.js'

function isChannelGroup(group) {
  return group?.kind === JID_KIND.CHANNEL
}

function toMonitorGroup(group, targetPostJids = []) {
  return {
    id: group.id,
    waJid: group.waJid,
    kind: group.kind,
    // 2026-07 (specs/001-image-mode-preview-default): a escolha de imagem por
    // grupo (seletor no painel) foi DESATIVADA — todo grupo monitorado sai
    // sempre como card de "Preview clicável do WhatsApp", independente do
    // valor persistido em `group.imageMode` ('fetch'/'original'/'none'/nulo/
    // legado). Este é o chokepoint de defesa em profundidade (FR-001/FR-009):
    // mesmo que a coluna `Group.imageMode` ainda exista (dormente, para
    // reativação futura) e a migration de dados não tenha rodado num grupo
    // específico, o pipeline de envio nunca lê o valor persistido — ele
    // ignora `group.imageMode` e força 'preview' aqui. Os ramos de código que
    // tratavam 'fetch'/'original'/'none' (src/bot-worker.js,
    // src/monitoredRelayPolicy.js, src/converters/imageScrapers.js)
    // permanecem no repositório intactos/dormentes (FR-006) — não excluir.
    imageMode: 'preview',
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
