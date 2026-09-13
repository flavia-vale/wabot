import { decryptCredential } from '../../credentialCrypto.js'
import { getPlanAccess } from '../../billing/plans.js'
import { createInstagramPublishingClient, InstagramPublishingError } from './client.js'

const sleepDefault = ms => new Promise(resolve => setTimeout(resolve, ms))

// A Meta permite 25 publicações por conta a cada 24h na Content Publishing
// API. O default otimista de 100 fazia o pré-check passar e a recusa acontecer
// só no `media_publish`, já com container criado.
export const META_DEFAULT_QUOTA_TOTAL = 25

// Cadência mínima entre Stories da MESMA conta. O WhatsApp tem um módulo de
// preservação inteiro contra rajada; o Instagram não tinha nada e disparava
// tantos containers quanto a concorrência da fila permitisse — que é o padrão
// que a Meta associa a automação abusiva. Sai por env para virar 0 em teste.
export const STORY_MIN_INTERVAL_MS = Number(process.env.INSTAGRAM_MIN_INTERVAL_MS ?? 90_000)

// Quando a cota diária estoura, esperar minutos não adianta: a janela da Meta
// é de 24h. Antes eram 5 tentativas com backoff de 30s (≈8 min) e a publicação
// morria como `failed` — numa conta com automação, a maior parte do dia caía
// aí. Agora o job volta para o fim da janela.
export const PUBLISHING_LIMIT_RETRY_MS = Number(process.env.INSTAGRAM_LIMIT_RETRY_MS ?? 60 * 60_000)

function quota(limit) {
  const row = Array.isArray(limit?.data) ? limit.data[0] : limit
  const total = Number(row?.config?.quota_total)
  return { used: Number(row?.quota_usage || 0), total: Number.isFinite(total) && total > 0 ? total : META_DEFAULT_QUOTA_TOTAL }
}

// Espaça o próximo Story da conta sem ocupar o slot da fila: devolve por quanto
// tempo o job deve ser adiado, ou 0 quando já pode sair.
export function storyPacingDelayMs(lastPublishedAt, now, minIntervalMs = STORY_MIN_INTERVAL_MS) {
  if (!minIntervalMs || !lastPublishedAt) return 0
  const elapsed = now.getTime() - new Date(lastPublishedAt).getTime()
  return elapsed >= minIntervalMs ? 0 : minIntervalMs - elapsed
}

export async function processInstagramPublication(publicationId, { db, storage, config, clientFactory = createInstagramPublishingClient, sleep = sleepDefault, now = () => new Date() } = {}) {
  const publication = await db.storyPublication.findUnique({ where: { id: publicationId }, include: { destination: { include: { instagramConnection: true } }, renderedAsset: true } })
  if (!publication) throw new InstagramPublishingError('PUBLICATION_NOT_FOUND', 'Publicação não encontrada')
  if (publication.status === 'published') return { published: true, duplicate: true }
  if (publication.status === 'cancelled') return { skipped: 'cancelled' }
  // Estados de processamento só são retomados depois do lease: aceitar um
  // `processing` recente permitiria dois workers publicarem o mesmo Story se
  // o BullMQ classificasse um job lento como stalled.
  const recoverableBefore = new Date(now().getTime() - 10 * 60_000)
  const claimed = await db.storyPublication.updateMany({ where: { id: publication.id, OR: [{ status: { in: ['queued', 'retry_scheduled'] } }, { status: { in: ['processing', 'container_processing'] }, updatedAt: { lt: recoverableBefore } }] }, data: { status: 'processing', lastErrorCode: null, lastErrorMessage: null } })
  if (!claimed.count) return { skipped: 'already_processing' }
  const attemptNumber = await db.storyPublicationAttempt.count({ where: { publicationId } }) + 1
  const attempt = await db.storyPublicationAttempt.create({ data: { publicationId, attemptNumber, phase: publication.providerContainerId ? 'reconcile' : 'container', status: 'processing' } })
  let containerId = publication.providerContainerId
  let phase = containerId ? 'reconcile' : 'container'
  try {
    const connection = publication.destination?.instagramConnection
    if (!connection || connection.status !== 'connected' || connection.loginMethod !== config.loginMethod) throw new InstagramPublishingError('CONNECTION_UNAVAILABLE', 'Conexão Instagram indisponível')
    const { entitlements } = await getPlanAccess(publication.userId, { db, now: now().getTime() })
    if (!entitlements.canUseInstagramStories) throw new InstagramPublishingError('FEATURE_REQUIRES_PREMIUM', 'Requer plano acima do Pro')
    if (!publication.renderedAsset || publication.renderedAsset.deletedAt || publication.renderedAsset.expiresAt <= now()) throw new InstagramPublishingError('ASSET_UNAVAILABLE', 'Imagem do Story indisponível')
    const token = decryptCredential(connection.encryptedToken)
    if (!token || token.startsWith('v1:')) throw new InstagramPublishingError('INVALID_CREDENTIAL', 'Credencial Instagram inválida')
    const client = clientFactory(config, token)
    if (!containerId) {
      const previous = await db.storyPublication.findFirst({ where: { userId: publication.userId, destinationId: publication.destinationId, status: 'published' }, orderBy: { publishedAt: 'desc' }, select: { publishedAt: true } })
      const pacing = storyPacingDelayMs(previous?.publishedAt, now())
      if (pacing > 0) throw new InstagramPublishingError('STORY_PACING', 'Aguardando o intervalo mínimo entre Stories da conta', { retryable: true, retryAfterMs: pacing })
      const budget = quota(await client.publishingLimit(connection.instagramAccountId))
      if (budget.used >= budget.total) throw new InstagramPublishingError('PUBLISHING_LIMIT_REACHED', 'Limite diário de publicação da conta atingido', { retryable: true, retryAfterMs: PUBLISHING_LIMIT_RETRY_MS })
      const imageUrl = storage.signedUrl(publication.renderedAsset.storageKey, publication.renderedAsset.expiresAt)
      const created = await client.createContainer(connection.instagramAccountId, imageUrl)
      if (!created.id) throw new InstagramPublishingError('INVALID_META_RESPONSE', 'Meta não retornou container')
      containerId = created.id
      await db.storyPublication.update({ where: { id: publication.id }, data: { providerContainerId: containerId, status: 'container_processing' } })
    }
    const deadline = now().getTime() + 5 * 60_000
    let ready = false
    while (now().getTime() <= deadline) {
      const state = await client.getContainer(containerId)
      if (state.status_code === 'PUBLISHED') {
        await db.storyPublication.update({ where: { id: publication.id }, data: { status: 'published', publishedAt: now() } })
        await db.storyPublicationAttempt.update({ where: { id: attempt.id }, data: { phase: 'reconcile', status: 'success', completedAt: now(), providerStatus: 'PUBLISHED' } })
        return { published: true, reconciled: true }
      }
      if (state.status_code === 'FINISHED') { ready = true; break }
      if (['ERROR', 'EXPIRED'].includes(state.status_code)) throw new InstagramPublishingError(`CONTAINER_${state.status_code}`, `Container ${state.status_code}`)
      await sleep(10_000)
    }
    if (!ready) throw new InstagramPublishingError('CONTAINER_TIMEOUT', 'Container não ficou pronto em cinco minutos', { retryable: true })
    phase = 'publish'
    const media = await client.publish(connection.instagramAccountId, containerId)
    if (!media.id) throw new InstagramPublishingError('INVALID_META_RESPONSE', 'Meta não retornou mídia', { ambiguous: true })
    await db.storyPublication.update({ where: { id: publication.id }, data: { status: 'published', providerMediaId: media.id, publishedAt: now() } })
    await db.storyPublicationAttempt.update({ where: { id: attempt.id }, data: { phase, status: 'success', completedAt: now(), providerRequestId: media.id } })
    return { published: true, mediaId: media.id }
  } catch (error) {
    const ambiguous = phase === 'publish' && error.ambiguous
    const status = ambiguous ? 'reconciliation_required' : error.retryable ? 'retry_scheduled' : 'failed'
    await db.storyPublication.update({ where: { id: publication.id }, data: { status, lastErrorCode: error.code || 'UNEXPECTED_ERROR', lastErrorMessage: String(error.message).slice(0, 500) } })
    await db.storyPublicationAttempt.update({ where: { id: attempt.id }, data: { phase, status: 'failed', retryDisposition: ambiguous ? 'reconcile' : error.retryable ? 'retryable' : 'permanent', errorCode: error.code || 'UNEXPECTED_ERROR', errorMessage: String(error.message).slice(0, 500), completedAt: now() } })
    // Uma resposta perdida de media_publish pode significar que a publicação
    // já ocorreu. Retry automático poderia duplicar o Story; somente uma
    // reconciliação explícita pode liberar nova tentativa.
    if (ambiguous) error.retryable = false
    throw error
  }
}
