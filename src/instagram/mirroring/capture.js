import dbDefault from '../../db.js'
import { canUseInstagramStories } from '../../billing/plans.js'
import { truncateByCodePoints } from '../../messageLogSanitizer.js'

// Janela de dedup do Story espelhado. O espelhamento WhatsApp bloqueia repost
// da origem pela dedup de link, mas a captura roda ANTES desse bloco no
// bot-worker — sem esta guarda a mesma oferta reposta pela origem virava um
// Story novo a cada mensagem (o par único (destino, mensagem) não protege:
// cada repost tem key.id diferente).
export const MIRROR_STORY_DEDUP_WINDOW_MS = Number(process.env.INSTAGRAM_MIRROR_DEDUP_WINDOW_MS) || 12 * 60 * 60_000

const TITLE_MAX_CODE_POINTS = 180

// Flag `u` obrigatória: sem ela a classe é lida em code UNITS e o alto
// surrogate compartilhado (\uD83D) some de QUALQUER emoji do mesmo bloco —
// "🎁 Brinde" virava "\udf81 Brinde". Mesma família de defeito do RCA
// 2026-09-11 (chave de dedup com emoji cortado).
const DECORATION_RE = /[*_~`]|\p{Extended_Pictographic}️?/gu

export function titleFromText(text) {
  const line = String(text || '')
    .split('\n')
    .map(raw => raw.replace(DECORATION_RE, '').replace(/\s+/g, ' ').trim())
    // Linha que é só link, só preço ou só chamada não nomeia o produto: a
    // primeira linha da mensagem costuma ser o banner do grupo de origem.
    .filter(candidate => candidate.length >= 12
      && !/^https?:\/\//i.test(candidate)
      && !/^(?:de|por|apenas|s[óo])\b/i.test(candidate)
      && /\p{L}{3}/u.test(candidate))
    .find(Boolean)
  // Corte por code point (nunca `.slice`, que conta code units e parte emoji).
  return line ? truncateByCodePoints(line, TITLE_MAX_CODE_POINTS) : 'Oferta selecionada'
}

export function productKeyForMirror(primary) {
  const raw = String(primary?.url || primary?.converted || '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return `${url.host}${url.pathname}`.toLowerCase().replace(/\/+$/, '')
  } catch {
    return raw.toLowerCase()
  }
}

export async function captureInstagramMirror({ user, sourceGroupId, sourceMessageKey, text, primary }, { db = dbDefault, now = () => new Date() } = {}) {
  if (!sourceGroupId || !sourceMessageKey || !primary?.converted || !canUseInstagramStories(user)) return { captured: 0 }
  const targets = await db.instagramMirrorDestination.findMany({ where: { sourceGroupId, sourceGroup: { userId: user.id }, destination: { userId: user.id, type: 'instagram_story', enabled: true, instagramConnection: { status: 'connected' } } }, select: { destinationId: true } })
  if (!targets.length) return { captured: 0 }
  // A resolução da imagem, do título e do preço é deliberadamente adiada para o
  // consumidor da API: rede de marketplace nunca deve atrasar o hot path do
  // bot-worker WhatsApp.
  const productKey = productKeyForMirror(primary)
  const offer = { offerKey: sourceMessageKey, title: titleFromText(text), productUrl: primary.converted, storeName: primary.platform, attributes: { sourcePlatform: primary.platform, sourceUrl: primary.url || primary.converted, sourceText: truncateByCodePoints(String(text || ''), 1200) } }
  const dedupSince = new Date(now().getTime() - MIRROR_STORY_DEDUP_WINDOW_MS)
  let captured = 0
  let deduped = 0
  for (const { destinationId } of targets) {
    try {
      if (productKey && MIRROR_STORY_DEDUP_WINDOW_MS > 0) {
        const repeated = await db.instagramStoryIngress.findFirst({ where: { destinationId, productKey, createdAt: { gte: dedupSince } }, select: { id: true } })
        if (repeated) { deduped++; continue }
      }
      await db.instagramStoryIngress.create({ data: { userId: user.id, destinationId, sourceMessageKey, productKey, offerSnapshotJson: JSON.stringify(offer) } })
      captured++
    } catch (error) {
      if (error?.code !== 'P2002') throw error
    }
  }
  return { captured, deduped }
}
