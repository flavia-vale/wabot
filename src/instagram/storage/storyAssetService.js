import { getPlanAccess } from '../../billing/plans.js'
import { renderInstagramStory } from '../rendering/renderer.js'

export const DEFAULT_STORY_ASSET_TTL_MS = 7 * 24 * 60 * 60_000

export async function renderAndStoreStory({ userId, offer, productImage, template, publicationId, minimumExpiresAt = null }, { db, storage, now = () => new Date(), renderer = renderInstagramStory } = {}) {
  if (!db || !storage) throw new Error('db e storage obrigatórios')
  const { entitlements } = await getPlanAccess(userId, { db, now: now().getTime() })
  if (!entitlements.canUseInstagramStories) throw Object.assign(new Error('Instagram Stories exige o plano acima do Pro'), { code: 'FEATURE_REQUIRES_PREMIUM' })
  const rendered = await renderer({ offer, productImage, template })
  const defaultExpiry = now().getTime() + DEFAULT_STORY_ASSET_TTL_MS
  const requestedExpiry = minimumExpiresAt ? new Date(minimumExpiresAt).getTime() : 0
  const expiresAt = new Date(Math.max(defaultExpiry, Number.isFinite(requestedExpiry) ? requestedExpiry : 0))
  const stored = await storage.put(rendered.buffer, { expiresAt })
  try {
    const asset = await db.renderedAsset.create({ data: {
      userId, storageKey: stored.storageKey, contentHash: stored.contentHash,
      mimeType: rendered.mimeType, byteSize: stored.byteSize,
      width: rendered.width, height: rendered.height, expiresAt,
      ...(publicationId ? { publications: { connect: { id: publicationId } } } : {}),
    } })
    return Object.freeze({ asset, publicUrl: storage.signedUrl(stored.storageKey, expiresAt), rendered })
  } catch (error) {
    await storage.remove(stored.storageKey).catch(() => {})
    throw error
  }
}

export async function cleanupExpiredStoryAssets({ db, storage, now = () => new Date(), limit = 200 } = {}) {
  if (!db || !storage) throw new Error('db e storage obrigatórios')
  const expired = await db.renderedAsset.findMany({
    where: { expiresAt: { lte: now() }, deletedAt: null },
    select: { id: true, storageKey: true },
    orderBy: { expiresAt: 'asc' },
    take: Math.max(1, Math.min(1000, Number(limit) || 200)),
  })
  let removed = 0
  for (const asset of expired) {
    try {
      await storage.remove(asset.storageKey)
      await db.renderedAsset.updateMany({ where: { id: asset.id, deletedAt: null }, data: { deletedAt: now() } })
      removed++
    } catch {
      // Mantém deletedAt nulo: a próxima varredura tentará novamente.
    }
  }
  // Varredura de ÓRFÃO: arquivo cuja linha sumiu (anonimização LGPD, queda
  // entre gravar o arquivo e gravar a linha) era invisível para a limpeza
  // acima, que é guiada pelo banco — e ficava no disco para sempre. O storage
  // sabe a expiração pelo próprio nome do arquivo, então não precisa do banco.
  let orphans = 0
  if (storage.cleanup) {
    try { orphans = (await storage.cleanup({ olderThan: now() }))?.removed ?? 0 } catch { /* próxima passada tenta */ }
  }
  return { scanned: expired.length, removed, orphans }
}

export function startStoryAssetCleanup({ db, storage, logger = console, intervalMs = 60 * 60_000 } = {}) {
  if (!db || !storage) return () => {}
  const tick = () => cleanupExpiredStoryAssets({ db, storage })
    .then(result => { if (result.removed || result.orphans) logger.info?.(result, 'Assets expirados de Stories removidos') })
    .catch(error => logger.error?.({ err: error.message }, 'Falha ao limpar assets expirados de Stories'))
  const timer = setInterval(tick, Math.max(60_000, intervalMs))
  timer.unref?.()
  tick()
  return () => clearInterval(timer)
}
