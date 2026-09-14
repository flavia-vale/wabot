import dbDefault from '../../db.js'
import { ensureCountQuota } from '../quotas.js'
import { loadUserPlanSubject, validateOwnedTargetJids } from './broadcastTargets.js'
import { buildFeatureGateError, canUseOfferAutomations, canUseInstagramStories, FEATURE_CODES } from '../../billing/plans.js'
import { runAutomation, searchOffersPreview } from '../../offerAutomation/dispatcher.js'
import { normalizeDailyRunTime } from '../../offerAutomation/schedule.js'
import { parseCredentialData } from '../../credentialHealth.js'
import { canUseReview } from '../../offerAutomation/reviewFlags.js'
import { REVIEW_STATUS } from '../../offerAutomation/reviewState.js'
import { deliverApprovedReviewItems } from '../../offerAutomation/reviewDeliveryService.js'

const VALID_INTERVALS = [15, 30, 45, 60, 120, 240, 360, 720, 1440]
const MAX_OFFERS_PER_SEND = 5
const DEFAULT_TEMPLATE_KEY = 'automatico_classico'
const TEMPLATE_KEY_RE = /^[a-zA-Z0-9_-]{1,80}$/
const DAILY_INTERVAL_MINUTES = 1440
// Valores aceitos pela API productOfferV2 da Shopee (doc oficial BR):
// sortType 1=Relevância 2=Mais vendidos 3=Maior preço 4=Menor preço 5=Maior comissão
// listType 0=Recomendados 1=Maior comissão 2=Melhor desempenho
const VALID_SORT_TYPES = [1, 2, 3, 4, 5]
const VALID_LIST_TYPES = [0, 1, 2]

function normalizeTemplateKey(value) {
  const key = String(value ?? DEFAULT_TEMPLATE_KEY).trim() || DEFAULT_TEMPLATE_KEY
  if (!TEMPLATE_KEY_RE.test(key)) return null
  return key
}

// destGroupJid precisa ser um grupo de destino cadastrado do próprio tenant —
// sem isso a automação dispara para qualquer JID arbitrário pela sessão do
// usuário. Devolve o JID normalizado ou null (validateOwnedTargetJids lança
// 400 com mensagem amigável quando o grupo não pertence ao tenant).
async function resolveOwnedDestGroupJid(db, userId, destGroupJid) {
  const [normalized] = await validateOwnedTargetJids({ db, userId, jids: [destGroupJid] })
  return normalized ?? null
}

async function resolveInstagramDestinations(db, userId, ids, subject) {
  const unique = [...new Set(Array.isArray(ids) ? ids.filter(Boolean) : [])]
  if (unique.length > 10) throw Object.assign(new Error('Selecione no máximo 10 destinos Instagram'), { statusCode: 400 })
  if (!unique.length) return []
  if (!canUseInstagramStories(subject)) throw Object.assign(new Error('Instagram Stories exige o plano superior ao Pro'), { statusCode: 403, code: 'FEATURE_REQUIRES_PREMIUM' })
  const rows = await db.destination.findMany({ where: { id: { in: unique }, userId, type: 'instagram_story', enabled: true, instagramConnection: { status: 'connected' } }, select: { id: true } })
  if (rows.length !== unique.length) throw Object.assign(new Error('Um ou mais destinos Instagram são inválidos ou não pertencem à sua conta'), { statusCode: 400 })
  return unique
}

function presentAutomation(row) {
  const instagramDestinationIds = row.instagramDestinations?.map(item => item.destinationId) ?? []
  const { instagramDestinations, ...automation } = row
  return { ...automation, instagramDestinationIds }
}

export async function offerAutomationRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const deliverApproved = opts.deliverApprovedReviewItemsFn ?? deliverApprovedReviewItems
  const deliverReview = (database, automation) => deliverApproved(automation, { db: database })

  // Ofertas automáticas são feature Pro (ou Trial ativo). Listar e deletar
  // seguem liberados: a UI precisa mostrar o que existe e o usuário pode
  // limpar automações antigas mesmo sem o plano.
  async function ensureOfferAutomationAllowed(req, reply) {
    const subject = await loadUserPlanSubject(db, req.user.sub)
    if (canUseOfferAutomations(subject)) return true
    reply.code(403).send(buildFeatureGateError(FEATURE_CODES.OFFER_AUTOMATIONS))
    return false
  }

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const rows = await db.offerAutomation.findMany({
      where: { userId: req.user.sub },
      include: { instagramDestinations: { select: { destinationId: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(presentAutomation)
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await ensureOfferAutomationAllowed(req, reply))) return reply
    const { destGroupJid, destGroupName, instagramDestinationIds, keyword, intervalMinutes, dailyRunTime, offersPerSend, minDiscountPct, sortType, listType, prioritizeAMS, isKeySeller, templateKey, publicationMode = 'direct', reviewTargetSize = 10 } = req.body ?? {}

    if (!keyword?.trim()) return reply.code(400).send({ error: 'Palavra-chave obrigatória' })
    if (!['direct', 'review'].includes(publicationMode)) return reply.code(400).send({ error: 'Modo de publicação inválido' })
    if (publicationMode === 'review' && !canUseReview(req.user.sub)) return reply.code(403).send({ error: 'Fila de revisão ainda não está liberada para esta conta' })
    const targetSize = Number(reviewTargetSize)
    if (!Number.isInteger(targetSize) || targetSize < 5 || targetSize > 30) return reply.code(400).send({ error: 'A fila deve guardar entre 5 e 30 ofertas' })
    const subject = await loadUserPlanSubject(db, req.user.sub)
    let instagramIds
    try { instagramIds = await resolveInstagramDestinations(db, req.user.sub, instagramDestinationIds, subject) } catch (error) { return reply.code(error.statusCode || 400).send(error.code ? buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES) : { error: error.message }) }
    let ownedDestJid = null
    if (destGroupJid) ownedDestJid = await resolveOwnedDestGroupJid(db, req.user.sub, destGroupJid)
    if (destGroupJid && !ownedDestJid) return reply.code(400).send({ error: 'Grupo de destino inválido' })
    if (!ownedDestJid && !instagramIds.length) return reply.code(400).send({ error: 'Escolha ao menos um grupo ou destino Instagram' })
    if (!VALID_INTERVALS.includes(Number(intervalMinutes))) {
      return reply.code(400).send({ error: `Intervalo inválido. Valores aceitos: ${VALID_INTERVALS.join(', ')} minutos` })
    }
    const parsedIntervalMinutes = Number(intervalMinutes)
    const parsedDailyRunTime = dailyRunTime == null || dailyRunTime === '' ? null : normalizeDailyRunTime(dailyRunTime)
    if (parsedIntervalMinutes === DAILY_INTERVAL_MINUTES && dailyRunTime && !parsedDailyRunTime) {
      return reply.code(400).send({ error: 'Horário diário inválido. Use HH:mm.' })
    }
    const perSend = Number(offersPerSend)
    if (!perSend || perSend < 1 || perSend > MAX_OFFERS_PER_SEND) {
      return reply.code(400).send({ error: `offersPerSend deve ser entre 1 e ${MAX_OFFERS_PER_SEND}` })
    }
    const parsedSortType = Number(sortType ?? 2)
    if (!VALID_SORT_TYPES.includes(parsedSortType)) {
      return reply.code(400).send({ error: 'sortType inválido. Use 1 (relevância), 2 (mais vendidos), 3 (maior preço), 4 (menor preço) ou 5 (maior comissão)' })
    }
    const parsedListType = Number(listType ?? 1)
    if (!VALID_LIST_TYPES.includes(parsedListType)) {
      return reply.code(400).send({ error: 'listType inválido. Use 0 (recomendados), 1 (maior comissão) ou 2 (melhor desempenho)' })
    }
    const parsedTemplateKey = normalizeTemplateKey(templateKey)
    if (!parsedTemplateKey) return reply.code(400).send({ error: 'templateKey inválido' })
    if (!(await ensureCountQuota(reply, {
      userId: req.user.sub,
      quota: 'automationsPerUser',
      count: () => db.offerAutomation.count({ where: { userId: req.user.sub } }),
      label: 'automações de oferta',
      db,
    }))) return

    return db.offerAutomation.create({
      data: {
        userId: req.user.sub,
        destGroupJid: ownedDestJid,
        destGroupName: ownedDestJid ? (destGroupName ?? destGroupJid) : null,
        instagramDestinations: { create: instagramIds.map(destinationId => ({ destinationId })) },
        keyword: keyword.trim(),
        templateKey: parsedTemplateKey,
        intervalMinutes: parsedIntervalMinutes,
        dailyRunTime: parsedIntervalMinutes === DAILY_INTERVAL_MINUTES ? parsedDailyRunTime : null,
        offersPerSend: perSend,
        minDiscountPct: Number(minDiscountPct) || 0,
        sortType: parsedSortType,
        listType: parsedListType,
        prioritizeAMS: Boolean(prioritizeAMS ?? false),
        isKeySeller: Boolean(isKeySeller ?? false),
        publicationMode,
        reviewTargetSize: targetSize,
      },
    })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await ensureOfferAutomationAllowed(req, reply))) return reply
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })

    const { keyword, intervalMinutes, dailyRunTime, offersPerSend, minDiscountPct, enabled, destGroupJid, destGroupName, instagramDestinationIds, prioritizeAMS, isKeySeller, sortType, listType, templateKey, publicationMode, reviewTargetSize, confirmPublicationModeChange } = req.body ?? {}
    const updates = {}
    if (publicationMode !== undefined) {
      if (!['direct', 'review'].includes(publicationMode)) return reply.code(400).send({ error: 'Modo de publicação inválido' })
      if (publicationMode === 'review' && !canUseReview(req.user.sub)) return reply.code(403).send({ error: 'Fila de revisão ainda não está liberada para esta conta' })
      if (publicationMode !== existing.publicationMode && confirmPublicationModeChange !== true) return reply.code(409).send({ error: 'Confirme a mudança do modo de publicação' })
      updates.publicationMode = publicationMode
    }
    if (reviewTargetSize !== undefined) {
      const size = Number(reviewTargetSize)
      if (!Number.isInteger(size) || size < 5 || size > 30) return reply.code(400).send({ error: 'A fila deve guardar entre 5 e 30 ofertas' })
      updates.reviewTargetSize = size
    }

    if (keyword !== undefined) {
      const k = keyword.trim()
      if (!k) return reply.code(400).send({ error: 'Palavra-chave não pode ficar vazia' })
      updates.keyword = k
    }
    if (destGroupJid !== undefined) {
      const ownedDestJid = destGroupJid ? await resolveOwnedDestGroupJid(db, req.user.sub, destGroupJid) : null
      if (destGroupJid && !ownedDestJid) return reply.code(400).send({ error: 'Grupo de destino inválido' })
      updates.destGroupJid = ownedDestJid
      if (!ownedDestJid) updates.destGroupName = null
    }
    if (instagramDestinationIds !== undefined) {
      try {
        const subject = await loadUserPlanSubject(db, req.user.sub)
        const ids = await resolveInstagramDestinations(db, req.user.sub, instagramDestinationIds, subject)
        updates.instagramDestinations = { deleteMany: {}, create: ids.map(destinationId => ({ destinationId })) }
        if (!(updates.destGroupJid ?? existing.destGroupJid) && !ids.length) return reply.code(400).send({ error: 'Escolha ao menos um grupo ou destino Instagram' })
      } catch (error) { return reply.code(error.statusCode || 400).send(error.code ? buildFeatureGateError(FEATURE_CODES.INSTAGRAM_STORIES) : { error: error.message }) }
    }
    if (destGroupName !== undefined) updates.destGroupName = destGroupName
    if (intervalMinutes !== undefined) {
      if (!VALID_INTERVALS.includes(Number(intervalMinutes))) {
        return reply.code(400).send({ error: 'Intervalo inválido' })
      }
      updates.intervalMinutes = Number(intervalMinutes)
      if (Number(intervalMinutes) !== DAILY_INTERVAL_MINUTES) updates.dailyRunTime = null
    }
    if (dailyRunTime !== undefined) {
      const parsedDailyRunTime = dailyRunTime === '' || dailyRunTime === null ? null : normalizeDailyRunTime(dailyRunTime)
      if (dailyRunTime && !parsedDailyRunTime) {
        return reply.code(400).send({ error: 'Horário diário inválido. Use HH:mm.' })
      }
      const effectiveInterval = updates.intervalMinutes ?? existing.intervalMinutes
      updates.dailyRunTime = Number(effectiveInterval) === DAILY_INTERVAL_MINUTES ? parsedDailyRunTime : null
    }
    if (offersPerSend !== undefined) {
      const ps = Number(offersPerSend)
      if (!ps || ps < 1 || ps > MAX_OFFERS_PER_SEND)
        return reply.code(400).send({ error: `offersPerSend deve ser entre 1 e ${MAX_OFFERS_PER_SEND}` })
      updates.offersPerSend = ps
    }
    if (minDiscountPct !== undefined) {
      const pct = Number(minDiscountPct)
      if (pct < 0 || pct > 100)
        return reply.code(400).send({ error: 'minDiscountPct deve estar entre 0 e 100' })
      updates.minDiscountPct = pct
    }
    if (enabled !== undefined) updates.enabled = Boolean(enabled)
    if (prioritizeAMS !== undefined) updates.prioritizeAMS = Boolean(prioritizeAMS)
    if (isKeySeller !== undefined) updates.isKeySeller = Boolean(isKeySeller)
    if (sortType !== undefined) {
      const st = Number(sortType)
      if (!VALID_SORT_TYPES.includes(st)) return reply.code(400).send({ error: 'sortType inválido' })
      updates.sortType = st
    }
    if (listType !== undefined) {
      const lt = Number(listType)
      if (!VALID_LIST_TYPES.includes(lt)) return reply.code(400).send({ error: 'listType inválido' })
      updates.listType = lt
    }
    if (templateKey !== undefined) {
      const parsedTemplateKey = normalizeTemplateKey(templateKey)
      if (!parsedTemplateKey) return reply.code(400).send({ error: 'templateKey inválido' })
      updates.templateKey = parsedTemplateKey
    }

    const invalidatesReview = existing.publicationMode === 'review' && (publicationMode === 'direct' || templateKey !== undefined || destGroupJid !== undefined || instagramDestinationIds !== undefined)
    if (invalidatesReview) await db.offerAutomationReviewItem.updateMany({ where: { automationId: existing.id, userId: req.user.sub, status: { in: [REVIEW_STATUS.AWAITING, REVIEW_STATUS.APPROVED] } }, data: { status: REVIEW_STATUS.EXPIRED } })
    return presentAutomation(await db.offerAutomation.update({ where: { id: req.params.id }, data: updates, include: { instagramDestinations: { select: { destinationId: true } } } }))
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })
    await db.offerAutomation.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  app.post('/:id/trigger', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await ensureOfferAutomationAllowed(req, reply))) return reply
    const automation = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      include: { instagramDestinations: { include: { destination: true } } },
    })
    if (!automation) return reply.code(404).send({ error: 'Automação não encontrada' })
    const subject = await loadUserPlanSubject(db, req.user.sub)
    if (!canUseInstagramStories(subject)) automation.instagramDestinations = []
    try {
      if (automation.publicationMode === 'review') {
        // A flag de delivery governa o envio AUTOMÁTICO do cron. O clique
        // explícito em "Enviar agora" deve continuar disponível durante o
        // piloto com delivery=false e ainda consome somente itens aprovados.
        // A automação já passou pelos gates ao ser criada/trocada para review;
        // repetir o feature gate aqui tornava uma ação manual legítima refém
        // das flags do processo e foi a origem direta do 409 no quality gate.
        const result = await deliverReview(db, automation)
        return { ok: true, result }
      }
      const result = await runAutomation(automation)
      return { ok: true, result }
    } catch (err) {
      return { ok: true, result: { error: err.message } }
    }
  })

  // Dry-run da busca a partir dos parâmetros escolhidos no formulário, SEM
  // enviar nada e SEM precisar de automação salva. Devolve o JSON do que a
  // busca traria para o usuário visualizar antes de criar/disparar.
  app.post('/search-preview', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await ensureOfferAutomationAllowed(req, reply))) return reply
    const { keyword, offersPerSend, minDiscountPct, sortType, listType, prioritizeAMS, isKeySeller, page } = req.body ?? {}

    if (!keyword?.trim()) return reply.code(400).send({ error: 'Palavra-chave obrigatória' })
    const perSend = Number(offersPerSend ?? 1)
    if (!perSend || perSend < 1 || perSend > MAX_OFFERS_PER_SEND) {
      return reply.code(400).send({ error: `offersPerSend deve ser entre 1 e ${MAX_OFFERS_PER_SEND}` })
    }
    const parsedSortType = Number(sortType ?? 2)
    if (!VALID_SORT_TYPES.includes(parsedSortType)) return reply.code(400).send({ error: 'sortType inválido' })
    const parsedListType = Number(listType ?? 1)
    if (!VALID_LIST_TYPES.includes(parsedListType)) return reply.code(400).send({ error: 'listType inválido' })
    const pct = Number(minDiscountPct) || 0
    if (pct < 0 || pct > 100) return reply.code(400).send({ error: 'minDiscountPct deve estar entre 0 e 100' })

    const credRow = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'shopee' } },
    })
    if (!credRow) return reply.code(400).send({ error: 'Credenciais Shopee não configuradas' })
    const creds = parseCredentialData(credRow.data)
    if (!creds?.appId || !creds?.secretKey) return reply.code(400).send({ error: 'Credenciais Shopee inválidas ou incompletas' })

    try {
      const preview = await searchOffersPreview({
        params: {
          keyword: keyword.trim(),
          offersPerSend: perSend,
          minDiscountPct: pct,
          sortType: parsedSortType,
          listType: parsedListType,
          page: Number(page) || 1,
          prioritizeAMS: Boolean(prioritizeAMS ?? false),
          isKeySeller: Boolean(isKeySeller ?? false),
        },
        creds,
      })
      return { ok: true, ...preview }
    } catch (err) {
      return reply.code(200).send({ ok: false, error: err.message })
    }
  })
}
