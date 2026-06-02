import dbDefault from '../../db.js'
import { runAutomation } from '../../offerAutomation/dispatcher.js'
import { searchOffersRaw, SEARCH_RESULT_LIMIT } from '../../offerAutomation/shopeeOffers.js'
import { parseCredentialData } from '../../credentialHealth.js'

const VALID_INTERVALS = [60, 120, 240, 360, 720, 1440]
const MAX_OFFERS_PER_SEND = 5

export async function offerAutomationRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.offerAutomation.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { destGroupJid, destGroupName, keyword, intervalMinutes, offersPerSend, minDiscountPct, sortType, isAMSOffer, isKeySeller } = req.body ?? {}

    if (!keyword?.trim()) return reply.code(400).send({ error: 'Palavra-chave obrigatória' })
    if (!destGroupJid) return reply.code(400).send({ error: 'Grupo de destino obrigatório' })
    if (!VALID_INTERVALS.includes(Number(intervalMinutes))) {
      return reply.code(400).send({ error: `Intervalo inválido. Valores aceitos: ${VALID_INTERVALS.join(', ')} minutos` })
    }
    const perSend = Number(offersPerSend)
    if (!perSend || perSend < 1 || perSend > MAX_OFFERS_PER_SEND) {
      return reply.code(400).send({ error: `offersPerSend deve ser entre 1 e ${MAX_OFFERS_PER_SEND}` })
    }
    const VALID_SORT_TYPES = [2, 5]
    const parsedSortType = Number(sortType ?? 2)
    if (!VALID_SORT_TYPES.includes(parsedSortType)) {
      return reply.code(400).send({ error: 'sortType inválido. Use 2 (mais vendidos) ou 5 (maior comissão)' })
    }

    return db.offerAutomation.create({
      data: {
        userId: req.user.sub,
        destGroupJid,
        destGroupName: destGroupName ?? destGroupJid,
        keyword: keyword.trim(),
        intervalMinutes: Number(intervalMinutes),
        offersPerSend: perSend,
        minDiscountPct: Number(minDiscountPct) || 0,
        sortType: parsedSortType,
        isAMSOffer: Boolean(isAMSOffer ?? false),
        isKeySeller: Boolean(isKeySeller ?? false),
      },
    })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.offerAutomation.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (!existing) return reply.code(404).send({ error: 'Automação não encontrada' })

    const { keyword, intervalMinutes, offersPerSend, minDiscountPct, enabled, destGroupJid, destGroupName } = req.body ?? {}
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

  // [TESTE — temporário] Busca crua no productOfferV2 com os parâmetros que o
  // usuário escolher, devolvendo os primeiros resultados sem filtro. Remover
  // junto com o painel de teste do dashboard.
  app.post('/search', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { keyword, sortType, listType, isAMSOffer, isKeySeller } = req.body ?? {}
    if (!keyword?.trim()) return reply.code(400).send({ error: 'Palavra-chave obrigatória' })

    const credRow = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'shopee' } },
    })
    if (!credRow) return reply.code(400).send({ error: 'Sem credenciais da Shopee. Configure appId e secretKey.' })
    const creds = parseCredentialData(credRow.data)
    if (!creds?.appId || !creds?.secretKey) {
      return reply.code(400).send({ error: 'Credenciais da Shopee incompletas (appId/secretKey).' })
    }

    try {
      const results = await searchOffersRaw({
        keyword: keyword.trim(),
        creds,
        sortType: Number(sortType ?? 2),
        listType: Number(listType ?? 1),
        isAMSOffer: Boolean(isAMSOffer),
        isKeySeller: Boolean(isKeySeller),
        limit: SEARCH_RESULT_LIMIT,
      })
      return { ok: true, count: results.length, results }
    } catch (err) {
      return reply.code(502).send({ error: err.message })
    }
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
}
