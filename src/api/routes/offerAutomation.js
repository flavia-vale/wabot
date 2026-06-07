import dbDefault from '../../db.js'
import { runAutomation, searchOffersPreview } from '../../offerAutomation/dispatcher.js'
import { normalizeDailyRunTime } from '../../offerAutomation/schedule.js'
import { parseCredentialData } from '../../credentialHealth.js'

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

export async function offerAutomationRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.offerAutomation.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { destGroupJid, destGroupName, keyword, intervalMinutes, dailyRunTime, offersPerSend, minDiscountPct, sortType, listType, prioritizeAMS, isKeySeller, templateKey } = req.body ?? {}

    if (!keyword?.trim()) return reply.code(400).send({ error: 'Palavra-chave obrigatória' })
    if (!destGroupJid) return reply.code(400).send({ error: 'Grupo de destino obrigatório' })
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

    return db.offerAutomation.create({
      data: {
        userId: req.user.sub,
        destGroupJid,
        destGroupName: destGroupName ?? destGroupJid,
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
      },
    })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })

    const { keyword, intervalMinutes, dailyRunTime, offersPerSend, minDiscountPct, enabled, destGroupJid, destGroupName, prioritizeAMS, isKeySeller, sortType, listType, templateKey } = req.body ?? {}
    const updates = {}

    if (keyword !== undefined) {
      const k = keyword.trim()
      if (!k) return reply.code(400).send({ error: 'Palavra-chave não pode ficar vazia' })
      updates.keyword = k
    }
    if (destGroupJid !== undefined) updates.destGroupJid = destGroupJid
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

    return db.offerAutomation.update({ where: { id: req.params.id }, data: updates })
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
    const automation = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!automation) return reply.code(404).send({ error: 'Automação não encontrada' })
    try {
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
