import dbDefault from '../../db.js'
import { canUseInstagramStories } from '../../billing/plans.js'

function titleFromText(text) {
  return String(text || '').split('\n').map(line => line.replace(/[*_~`🏷️🔥💥]/g, '').trim()).find(Boolean)?.slice(0, 180) || 'Oferta selecionada'
}

export async function captureInstagramMirror({ user, sourceGroupId, sourceMessageKey, text, primary }, { db = dbDefault } = {}) {
  if (!sourceGroupId || !sourceMessageKey || !primary?.converted || !canUseInstagramStories(user)) return { captured: 0 }
  const targets = await db.instagramMirrorDestination.findMany({ where: { sourceGroupId, sourceGroup: { userId: user.id }, destination: { userId: user.id, type: 'instagram_story', enabled: true, instagramConnection: { status: 'connected' } } }, select: { destinationId: true } })
  if (!targets.length) return { captured: 0 }
  // A resolução da imagem é deliberadamente adiada para o consumidor da API:
  // rede de marketplace nunca deve atrasar o hot path do bot-worker WhatsApp.
  const offer = { offerKey: sourceMessageKey, title: titleFromText(text), productUrl: primary.converted, storeName: primary.platform, callToAction: 'Oferta por tempo limitado', attributes: { sourcePlatform: primary.platform, sourceUrl: primary.url || primary.converted } }
  let captured = 0
  for (const { destinationId } of targets) {
    try {
      await db.instagramStoryIngress.create({ data: { userId: user.id, destinationId, sourceMessageKey, offerSnapshotJson: JSON.stringify(offer) } })
      captured++
    } catch (error) {
      if (error?.code !== 'P2002') throw error
    }
  }
  return { captured }
}
