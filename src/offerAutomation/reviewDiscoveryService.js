import dbDefault from '../db.js'
import { parseCredentialData } from '../credentialHealth.js'
import { dedupeOffersByProduct } from './shopeeOffers.js'
import { materializeAutomationOffer, resolveOffers } from './dispatcher.js'
import { REVIEW_STATUS } from './reviewState.js'

const DEFAULT_TTL_MS = 48 * 60 * 60_000
const discoveryLocks = new Set()

function targets(automation) {
  return {
    whatsapp: automation.destGroupJid ? { jid: automation.destGroupJid, name: automation.destGroupName } : null,
    instagram: (automation.instagramDestinations || []).map(link => ({ id: (link.destination ?? link).id })).filter(item => item.id),
  }
}

export async function discoverReviewItems(automation, deps = {}) {
  const lockKey = `${automation.userId}:${automation.id}`
  if (discoveryLocks.has(lockKey)) return { skipped: 'review_discovery_busy' }
  discoveryLocks.add(lockKey)
  try {
  const db = deps.db ?? dbDefault
  const now = deps.now ? deps.now() : new Date()
  const replacingAwaiting = deps.nextPage === true
  const capacityStatuses = replacingAwaiting
    ? [REVIEW_STATUS.APPROVED, REVIEW_STATUS.SENDING]
    : [REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED, REVIEW_STATUS.SENDING]
  const liveCount = await db.offerAutomationReviewItem.count({ where: { userId: automation.userId, automationId: automation.id, status: { in: capacityStatuses } } })
  const capacity = Math.max(0, Math.min(30, automation.reviewTargetSize || 10) - liveCount)
  if (!capacity) return { skipped: 'review_queue_full' }
  const credential = await db.credential.findUnique({ where: { userId_platform: { userId: automation.userId, platform: 'shopee' } } })
  if (!credential) return { skipped: 'no_shopee_credentials' }
  const creds = parseCredentialData(credential.data)
  if (!creds?.appId || !creds?.secretKey) return { skipped: 'invalid_shopee_credentials' }
  const living = await db.offerAutomationReviewItem.findMany({
    where: { automationId: automation.id, userId: automation.userId, OR: [{ status: { in: [REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED, REVIEW_STATUS.SENDING] } }, { status: REVIEW_STATUS.REMOVED, reviewedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60_000) } }] },
    select: { productKey: true, priceCents: true },
  })
  const blocked = new Set(living.map(item => `${item.productKey}:${item.priceCents}`))
  let sentItemIds = []
  try { sentItemIds = JSON.parse(automation.sentItemIds || '[]') } catch {}
  // Peça candidatos além das vagas livres. Caso contrário, uma nova busca
  // podia receber novamente só os itens que já estavam na fila, descartá-los
  // como repetidos e terminar vazia mesmo havendo outros produtos disponíveis.
  const searchSize = Math.min(50, capacity + living.length)
  const searchPage = replacingAwaiting ? Math.max(1, Number(automation.page) || 1) + 1 : Math.max(1, Number(automation.page) || 1)
  // A ordem e o conjunto de produtos são ESCOLHA DA CLIENTE (ver
  // dashboard/lib/offerAutomationSearch.js). Até 2026-09 a fila forçava
  // "mais vendidos" aqui — o que fazia sentido enquanto a escolha não existia
  // na tela, e passou a ser um jeito silencioso de descartá-la: a cliente
  // trocaria a busca no formulário e a fila continuaria montada de outro jeito.
  const { offers, rawCount } = await resolveOffers({ automation: { ...automation, offersPerSend: searchSize, page: searchPage }, sentItemIds, creds, fetchOffersFn: deps.fetchOffersFn })
  const botConfig = await db.botConfig.findUnique({ where: { userId: automation.userId } })
  const prepared = dedupeOffersByProduct(offers)
    .map(offer => materializeAutomationOffer(automation, offer, botConfig))
    .filter(item => !blocked.has(`${item.productKey}:${item.priceCents}`))
    .slice(0, capacity)
  const last = await db.offerAutomationReviewItem.findFirst({ where: { automationId: automation.id, userId: automation.userId }, orderBy: { position: 'desc' }, select: { position: true } })
  const targetSnapshot = JSON.stringify(targets(automation))
  await db.$transaction(async tx => {
    // Só troca a seleção atual depois de encontrar substitutas. Uma página
    // vazia ou uma falha externa nunca apaga o que a cliente já podia revisar.
    if (replacingAwaiting && prepared.length) await tx.offerAutomationReviewItem.updateMany({ where: { automationId: automation.id, userId: automation.userId, status: REVIEW_STATUS.AWAITING }, data: { status: REVIEW_STATUS.REMOVED, reviewedAt: now, reviewedAction: REVIEW_STATUS.REMOVED } })
    if (prepared.length) await tx.offerAutomationReviewItem.createMany({ data: prepared.map((item, index) => ({ ...item, productSnapshot: JSON.stringify(item.productSnapshot), targetSnapshot, userId: automation.userId, automationId: automation.id, position: (last?.position || 0) + index + 1, expiresAt: new Date(now.getTime() + (deps.ttlMs || DEFAULT_TTL_MS)) })) })
    await tx.offerAutomation.update({ where: { id: automation.id }, data: { lastDiscoveryAt: now, ...(replacingAwaiting && prepared.length ? { page: searchPage } : {}) } })
  })
  return { discovered: prepared.length, rawCount, replaced: replacingAwaiting && prepared.length > 0 }
  } finally {
    discoveryLocks.delete(lockKey)
  }
}
