import dbDefault from '../db.js'
import { isRunning as isRunningDefault, sendBroadcast as sendBroadcastDefault } from '../manager.js'
import { startOfSaoPauloDayUtc } from './time.js'
import { isOutsideOperatingHours } from './operatingHours.js'
import { createAndEnqueueStory } from '../instagram/storyDeliveryService.js'
import { getInstagramDeliveryRuntime } from '../instagram/publishing/runtime.js'
import { DELIVERY_SOURCE_TYPE } from '../domain/delivery/constants.js'

const drainingQueues = new Set()

// Códigos de bloqueio expostos pela UI (motivo de uma fila com itens pendentes
// não estar drenando). Mensagens em PT-BR ficam no dashboard; aqui vive a fonte
// única dos códigos para manter API e UI alinhadas.
export const QUEUE_BLOCK_REASONS = Object.freeze([
  'queue_disabled',
  'plan_inactive',
  'bot_offline',
  'outside_operating_hours',
  'quiet_hours',
  'interval_limit',
  'hourly_limit',
  'daily_limit',
])

// Lease do claim: se o processo cair entre pending->queued e o desfecho do
// envio, o watchdog devolve o item para 'pending' depois deste prazo.
export const OFFER_QUEUE_LEASE_MS = Math.max(60_000, Number(process.env.OFFER_QUEUE_LEASE_MS || 5 * 60_000))
export const OFFER_QUEUE_MAX_ATTEMPTS = Math.max(1, Number(process.env.OFFER_QUEUE_MAX_ATTEMPTS || 3))
const RETRY_BASE_MS = 60_000
const RETRY_MAX_MS = 3_600_000

export function getOfferQueueRetryDelayMs(attemptCount) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1), RETRY_MAX_MS)
}

function truncateError(error) {
  return String(error?.message ?? error ?? 'unknown').slice(0, 500)
}

// Watchdog: recupera itens cujo processo morreu entre o claim e o envio.
// - lease expirada + tentativas restantes -> volta para 'pending' (re-envio)
// - lease expirada + tentativas esgotadas -> 'failed' terminal com lastError
// - claimedAt null cobre linhas presas de antes da migration (legado).
export async function recoverStuckQueueItems(deps = {}) {
  const db = deps.db ?? dbDefault
  const now = deps.now ? deps.now() : new Date()
  const cutoff = new Date(now.getTime() - OFFER_QUEUE_LEASE_MS)
  const staleWhere = {
    status: 'queued',
    OR: [{ claimedAt: null }, { claimedAt: { lt: cutoff } }],
  }
  const exhausted = await db.offerQueueItem.updateMany({
    where: { ...staleWhere, attemptCount: { gte: OFFER_QUEUE_MAX_ATTEMPTS } },
    data: { status: 'failed', lastError: 'stuck_queued: lease expirado após esgotar tentativas' },
  })
  const requeued = await db.offerQueueItem.updateMany({
    where: staleWhere,
    data: { status: 'pending', claimedAt: null, lastError: 'stuck_queued: lease expirado, reencaminhado' },
  })
  return { requeued: requeued.count, exhausted: exhausted.count }
}

export async function drainQueueOnce(queue, deps = {}) {
  const lockKey = `${queue.userId}:${queue.id}`
  if (drainingQueues.has(lockKey)) return { skipped: 'queue_busy' }
  drainingQueues.add(lockKey)
  try { return await drainQueueUnlocked(queue, deps) }
  finally { drainingQueues.delete(lockKey) }
}

// Avalia, em modo SOMENTE-LEITURA, se a fila pode drenar agora. Devolve o
// código do motivo do bloqueio (ver QUEUE_BLOCK_REASONS) ou `null` quando está
// liberada. Extraído do dispatcher para ser reutilizado pela rota (GET /) que
// expõe o motivo na UI — assim "fila travada com itens pendentes" deixa de ser
// um mistério silencioso e o usuário vê POR QUE nada está saindo (bot offline,
// fora do horário, limite atingido etc.). NÃO faz claim nem envio.
export async function evaluateQueueGate(queue, deps = {}) {
  const db = deps.db ?? dbDefault
  const isRunning = deps.isRunning ?? isRunningDefault
  const now = deps.now ? deps.now() : new Date()
  if (!queue.enabled) return 'queue_disabled'
  // O gate do WhatsApp depende de a fila AINDA mandar no WhatsApp, não de ela
  // ter ganhado um destino Instagram. Antes, uma fila híbrida com o bot fora do
  // ar passava do gate, falhava no sendBroadcast, queimava tentativa e o item
  // virava `failed` terminal — regressão: antes ele só ficava `pending` com o
  // motivo `bot_offline` na tela. Fila Instagram-only tem whatsappEnabled=false.
  const usaWhatsapp = queue.whatsappEnabled !== false
  if (usaWhatsapp && !await isRunning(queue.userId)) return 'bot_offline'
  // Plano B / Fase 3: o horário próprio da fila é o único pré-check de janela
  // aqui. Sem horário próprio, NÃO pré-bloqueamos pela antiga janela silenciosa
  // global (aposentada) — a proteção anti-ban por destino é aplicada no envio
  // (checkAndReserve com destPreservation), que adia o item se necessário.
  if (queue.operatingHoursEnabled && isOutsideOperatingHours(now, queue.operatingHoursStart, queue.operatingHoursEnd)) {
    return 'outside_operating_hours'
  }
  if (queue.intervalEnabled && queue.lastSentAt && now - new Date(queue.lastSentAt) < queue.intervalMinutes * 60_000) return 'interval_limit'
  if (queue.hourlyCapEnabled) {
    const count = await db.offerQueueItem.count({ where: { queueId: queue.id, userId: queue.userId, status: 'sent', sentAt: { gte: new Date(now.getTime() - 3_600_000) } } })
    if (count >= queue.hourlyCap) return 'hourly_limit'
  }
  if (queue.dailyCapEnabled) {
    const count = await db.offerQueueItem.count({ where: { queueId: queue.id, userId: queue.userId, status: 'sent', sentAt: { gte: startOfSaoPauloDayUtc(now) } } })
    if (count >= queue.dailyCap) return 'daily_limit'
  }
  return null
}

async function drainQueueUnlocked(queue, deps = {}) {
  const db = deps.db ?? dbDefault
  const sendBroadcast = deps.sendBroadcast ?? sendBroadcastDefault
  const sendStory = deps.sendStory ?? createAndEnqueueStory
  const instagramRuntime = deps.instagramRuntime ?? getInstagramDeliveryRuntime()
  const now = deps.now ? deps.now() : new Date()
  if (!queue.enabled) return { skipped: 'queue_disabled' }
  const currentQueue = await db.offerQueue.findFirst({ where: { id: queue.id, userId: queue.userId, enabled: true }, include: { instagramDestinations: { include: { destination: true } } } })
  if (!currentQueue) return { skipped: 'queue_disabled' }
  queue = currentQueue
  // Gate centralizado (mesma lógica usada pelo diagnóstico read-only da rota).
  const gate = await evaluateQueueGate(queue, deps)
  if (gate) return { skipped: gate }
  const item = await db.offerQueueItem.findFirst({
    where: {
      queueId: queue.id,
      userId: queue.userId,
      status: 'pending',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { position: 'asc' },
  })
  if (!item) return { skipped: 'empty' }
  const claim = await db.offerQueueItem.updateMany({
    where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'pending', queue: { enabled: true } },
    data: { status: 'queued', claimedAt: now, attemptCount: { increment: 1 } },
  })
  if (claim.count !== 1) return { skipped: 'claim_lost' }
  const attemptCount = (item.attemptCount ?? 0) + 1
  const stillEnabled = await db.offerQueue.findFirst({ where: { id: queue.id, userId: queue.userId, enabled: true }, select: { id: true } })
  if (!stillEnabled) {
    await db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'pending', claimedAt: null } })
    return { skipped: 'queue_disabled' }
  }
  try {
    const targetJids = JSON.parse(item.targetJids)
    // Instagram primeiro: se o WhatsApp estiver offline, o canal irmão não é
    // bloqueado. O retry posterior é seguro pela idempotência do Story.
    if (queue.instagramDestinations?.length) {
      if (!instagramRuntime) throw Object.assign(new Error('Fila de Instagram indisponível'), { code: 'INSTAGRAM_RUNTIME_UNAVAILABLE' })
      const offer = JSON.parse(item.offerSnapshot || 'null')
      if (!offer) throw new Error('Item sem snapshot da oferta para Instagram')
      for (const link of queue.instagramDestinations) {
        const destination = link.destination ?? link
        if (destination.enabled === false) continue
        await sendStory({ userId: queue.userId, destinationId: destination.id, offer, imageUrl: offer.imageUrl, sourceType: DELIVERY_SOURCE_TYPE.OFFER_QUEUE, sourceId: item.id, idempotencyKey: `offer-queue:${queue.id}:${item.id}:${destination.id}` }, instagramRuntime)
      }
    }
    if (targetJids.length) {
      const online = await (deps.isRunning ?? isRunningDefault)(queue.userId)
      if (!online) throw new Error('Bot não está rodando')
      await sendBroadcast(queue.userId, item.text, targetJids, { imageUrl: item.imageUrl ?? undefined, imageRefererUrl: item.imageRefererUrl ?? undefined, source: 'offerQueue', queueId: queue.id, ignoreGlobalQuietHours: queue.operatingHoursEnabled === true })
    }
    await db.$transaction([
      db.offerQueueItem.updateMany({ where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' }, data: { status: 'sent', sentAt: now, lastError: null } }),
      db.offerQueue.updateMany({ where: { id: queue.id, userId: queue.userId }, data: { lastSentAt: now } }),
    ])
    return { sent: item.id }
  } catch (error) {
    // Falha transitória ganha retry com backoff; tentativas esgotadas viram
    // 'failed' terminal com o motivo registrado (antes: 'failed' direto na
    // primeira falha, sem retry e sem lastError).
    const terminal = attemptCount >= OFFER_QUEUE_MAX_ATTEMPTS
    await db.offerQueueItem.updateMany({
      where: { id: item.id, queueId: queue.id, userId: queue.userId, status: 'queued' },
      data: terminal
        ? { status: 'failed', lastError: truncateError(error) }
        : { status: 'pending', claimedAt: null, nextAttemptAt: new Date(now.getTime() + getOfferQueueRetryDelayMs(attemptCount)), lastError: truncateError(error) },
    })
    return terminal ? { failed: item.id, error } : { retrying: item.id, attemptCount, error }
  }
}
