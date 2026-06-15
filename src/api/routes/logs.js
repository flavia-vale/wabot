import db from '../../db.js'
import { categorizeErrorMsg, ERROR_CATEGORIES } from '../../errorTaxonomy.js'
import { buildOfferQueueSource, parseOfferQueueSourceId } from '../../offerQueue/sourceTag.js'

// Cache leve do /summary — métricas não precisam ser real-time-real-time.
// Chave: `${userId}:${period}`. TTL curto para não pesar no banco em refresh
// frenético do painel.
const SUMMARY_TTL_MS = 30_000
const summaryCache = new Map()

function getCachedSummary(key) {
  const hit = summaryCache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    summaryCache.delete(key)
    return null
  }
  return hit.payload
}

function setCachedSummary(key, payload) {
  summaryCache.set(key, { payload, expiresAt: Date.now() + SUMMARY_TTL_MS })
}

function resolvePeriodRange(period) {
  const now = new Date()
  const to = now
  let from
  if (period === 'today') {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
  } else if (period === '30d') {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60_000)
  } else {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60_000)
  }
  return { from, to }
}

export async function logsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const { status = 'all', page = '1', limit = '20', search = '' } = req.query
    const statusList = String(status || 'all')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item && item !== 'all')
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const rawQuery = String(search).trim()
    const query = rawQuery.length >= 3 ? rawQuery : ''

    const normalizedQuery = query.toLowerCase()
    const statusSearchMap = {
      sucesso: 'success',
      enviado: 'success',
      erro: 'error',
      falha: 'error',
      fila: 'queued',
      enviando: 'sending',
    }
    const statusMatches = Object.entries(statusSearchMap)
      .filter(([label, value]) => label.includes(normalizedQuery) || value.includes(normalizedQuery))
      .map(([, value]) => value)

    const groups = await db.group.findMany({ where: { userId } })
    const groupMap = Object.fromEntries(groups.map(g => [g.waJid, g.name]))
    const matchingGroupJids = query
      ? groups
        .filter(g => g.name.toLowerCase().includes(normalizedQuery) || g.waJid.toLowerCase().includes(normalizedQuery))
        .map(g => g.waJid)
      : []

    const matchingQueueSources = query
      ? (await db.offerQueue.findMany({ where: { userId }, select: { id: true, name: true } }))
          .filter((queue) => queue.name.toLowerCase().includes(normalizedQuery))
          .map((queue) => buildOfferQueueSource(queue.id))
      : []

    const searchWhere = query
      ? {
          OR: [
            { messageText: { contains: query } },
            { platform: { contains: query } },
            { sourceGroup: { contains: query } },
            { destGroup: { contains: query } },
            { originalUrl: { contains: query } },
            { convertedUrl: { contains: query } },
            { status: { contains: query } },
            { errorMsg: { contains: query } },
            ...(statusMatches.length ? [{ status: { in: statusMatches } }] : []),
            ...(matchingGroupJids.length ? [
              { sourceGroup: { in: matchingGroupJids } },
              { destGroup: { in: matchingGroupJids } },
            ] : []),
            ...(matchingQueueSources.length ? [{ sourceGroup: { in: matchingQueueSources } }] : []),
          ],
        }
      : {}

    // `status` aceita valor único ('success') ou lista separada por vírgula
    // ('queued,sending') — o mobile usa a lista para o filtro "Aguardando".
    // `statusList` é montado no topo do handler.
    const where = {
      userId,
      ...(statusList.length === 1 ? { status: statusList[0] } : {}),
      ...(statusList.length > 1 ? { status: { in: statusList } } : {}),
      ...searchWhere,
    }

    // Contagens por status de TODO o histórico (respeitando a busca, mas
    // ignorando o filtro de status ativo) para os chips refletirem o total
    // real — não apenas os itens carregados na tela.
    const countWhere = { userId, ...searchWhere }

    const [total, logs, grouped] = await Promise.all([
      db.messageLog.count({ where }),
      db.messageLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
      }),
      db.messageLog.groupBy({
        by: ['status'],
        where: countWhere,
        _count: { _all: true },
      }),
    ])

    const statusCounts = {}
    let statusCountsTotal = 0
    for (const row of grouped) {
      const n = row._count?._all || 0
      statusCounts[row.status] = n
      statusCountsTotal += n
    }

    const queueIds = [...new Set(logs.map((log) => parseOfferQueueSourceId(log.sourceGroup)).filter(Boolean))]
    const queueNameMap = queueIds.length
      ? Object.fromEntries(
          (await db.offerQueue.findMany({ where: { userId, id: { in: queueIds } }, select: { id: true, name: true } }))
            .map((queue) => [queue.id, queue.name]),
        )
      : {}

    const sourceGroupNameFor = (sourceGroup) => {
      if (sourceGroup === 'offerAutomation') return 'Oferta automática'
      const queueId = parseOfferQueueSourceId(sourceGroup)
      if (queueId) return `Fila · ${queueNameMap[queueId] || 'removida'}`
      return groupMap[sourceGroup] || sourceGroup
    }

    return {
      total,
      page: pageNum,
      limit: limitNum,
      statusCounts,
      statusCountsTotal,
      logs: logs.map(log => ({
        ...log,
        sourceGroupName: sourceGroupNameFor(log.sourceGroup),
        destGroupName: groupMap[log.destGroup] || log.destGroup,
      })),
    }
  })

  app.delete('/clear', { onRequest: [app.authenticate] }, async (req) => {
    await db.messageLog.deleteMany({ where: { userId: req.user.sub } })
    return { ok: true }
  })

  // Resumo agregado para os cards da página de Logs do cliente.
  // Conta sucessos, bloqueios por proteção (dedup) ou configuração, timeouts
  // e falhas reais no período pedido. As categorias vêm do errorTaxonomy.
  app.get('/summary', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const rawPeriod = String(req.query?.period || '7d').toLowerCase()
    const period = ['today', '7d', '30d'].includes(rawPeriod) ? rawPeriod : '7d'
    const cacheKey = `${userId}:${period}`
    const cached = getCachedSummary(cacheKey)
    if (cached) return cached

    const { from, to } = resolvePeriodRange(period)

    const logs = await db.messageLog.findMany({
      where: { userId, sentAt: { gte: from, lte: to } },
      select: { status: true, errorMsg: true, sourceGroup: true, destGroup: true, dedupHits: true },
    })

    const counts = {
      success: 0,
      skippedDedup: 0,
      skippedConfig: 0,
      timeoutTotal: 0,
      errorOther: 0,
      inFlight: 0,
    }
    const sourceAgg = new Map()
    const destAgg = new Map()

    for (const log of logs) {
      const hits = Number(log.dedupHits) || 0
      if (log.status === 'queued' || log.status === 'sending') {
        counts.inFlight++
        continue
      }
      if (log.status === 'success') {
        counts.success++
        // Repostas agregadas nesta linha (envio bem-sucedido + N duplicatas
        // bloqueadas depois) entram no card de "bloqueadas por repetição".
        counts.skippedDedup += hits
        const cur = sourceAgg.get(log.sourceGroup) || { sent: 0, blocked: 0 }
        cur.sent++
        cur.blocked += hits
        sourceAgg.set(log.sourceGroup, cur)
        if (log.destGroup && log.destGroup !== 'skipped' && log.destGroup !== 'conversion') {
          const dcur = destAgg.get(log.destGroup) || { sent: 0, errors: 0 }
          dcur.sent++
          destAgg.set(log.destGroup, dcur)
        }
        continue
      }

      const category = categorizeErrorMsg(log.errorMsg)

      if (category === ERROR_CATEGORIES.DEDUP) {
        // Fallback row (não havia linha original encontrável). +1 pela linha
        // + N pelas repetições agregadas nela.
        counts.skippedDedup += 1 + hits
        const cur = sourceAgg.get(log.sourceGroup) || { sent: 0, blocked: 0 }
        cur.blocked += 1 + hits
        sourceAgg.set(log.sourceGroup, cur)
        continue
      }
      if (category === ERROR_CATEGORIES.CONFIG_BLOCK) {
        counts.skippedConfig++
        continue
      }
      if (category === ERROR_CATEGORIES.TIMEOUT) {
        counts.timeoutTotal++
      } else if (log.status === 'error') {
        // Tudo que sobrou em status='error' e não é timeout vira "outras falhas":
        // queue_full, worker_restart, baileys, channel_forbidden/throttled,
        // conversion, outros legados não classificados.
        counts.errorOther++
      } else {
        // skip:decrypt_failed, skip:incoming_error, etc. — descarte técnico
        // que não interessa ao card. Contamos como "outras falhas" só se
        // ainda forem 'error'; senão ignoramos (caem em status='skipped' não
        // mapeado para card específico).
      }

      if (log.destGroup && log.destGroup !== 'skipped' && log.destGroup !== 'conversion' && log.status === 'error') {
        const dcur = destAgg.get(log.destGroup) || { sent: 0, errors: 0 }
        dcur.errors++
        destAgg.set(log.destGroup, dcur)
      }
    }

    const deliveryDenominator = counts.success + counts.timeoutTotal + counts.errorOther
    const deliveryRate = deliveryDenominator > 0
      ? counts.success / deliveryDenominator
      : null

    // Resolve nomes amigáveis dos grupos e filas para os top lists.
    const groups = await db.group.findMany({ where: { userId } })
    const groupMap = Object.fromEntries(groups.map(g => [g.waJid, g.name]))
    const summaryQueueIds = [...new Set(Array.from(sourceAgg.keys()).map((key) => parseOfferQueueSourceId(key)).filter(Boolean))]
    const summaryQueueNames = summaryQueueIds.length
      ? Object.fromEntries(
          (await db.offerQueue.findMany({ where: { userId, id: { in: summaryQueueIds } }, select: { id: true, name: true } }))
            .map((queue) => [queue.id, queue.name]),
        )
      : {}
    const nameFor = (jid) => {
      if (jid === 'offerAutomation') return 'Oferta automática'
      const queueId = parseOfferQueueSourceId(jid)
      if (queueId) return `Fila · ${summaryQueueNames[queueId] || 'removida'}`
      return groupMap[jid] || jid
    }

    const topSources = Array.from(sourceAgg.entries())
      .map(([jid, v]) => ({ jid, name: nameFor(jid), sent: v.sent, blocked: v.blocked }))
      .sort((a, b) => (b.sent + b.blocked) - (a.sent + a.blocked))
      .slice(0, 5)

    const topDestinations = Array.from(destAgg.entries())
      .map(([jid, v]) => ({ jid, name: nameFor(jid), sent: v.sent, errors: v.errors }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 5)

    const lastSendAt = await db.messageLog.findFirst({
      where: { userId, status: 'success' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    })

    const payload = {
      period,
      range: { from: from.toISOString(), to: to.toISOString() },
      counts,
      deliveryRate,
      topSources,
      topDestinations,
      lastSendAt: lastSendAt?.sentAt?.toISOString?.() || null,
    }
    setCachedSummary(cacheKey, payload)
    return payload
  })

  // Série diária para o gráfico de colunas do painel. Devolve um bucket por dia
  // nos últimos `days` dias (1..30, default 7), cada um com a contagem por
  // categoria (entregues / bloqueados / repetições / falhas). Buckets vazios
  // vêm com zero, para o gráfico não "pular" dias sem atividade.
  app.get('/series', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const days = Math.min(Math.max(parseInt(req.query?.days, 10) || 7, 1), 30)

    const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const to = new Date()

    const buckets = []
    const byKey = new Map()
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const bucket = {
        key: dayKey(d),
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        success: 0,
        blocked: 0,
        dedup: 0,
        failed: 0,
      }
      byKey.set(bucket.key, bucket)
      buckets.push(bucket)
    }

    const logs = await db.messageLog.findMany({
      where: { userId, sentAt: { gte: start, lte: to } },
      select: { status: true, errorMsg: true, sentAt: true, dedupHits: true },
    })

    for (const log of logs) {
      const bucket = byKey.get(dayKey(new Date(log.sentAt)))
      if (!bucket) continue
      const hits = Number(log.dedupHits) || 0
      if (log.status === 'queued' || log.status === 'sending') continue
      if (log.status === 'success') {
        bucket.success++
        bucket.dedup += hits
        continue
      }
      const category = categorizeErrorMsg(log.errorMsg)
      if (category === ERROR_CATEGORIES.DEDUP) bucket.dedup += 1 + hits
      else if (category === ERROR_CATEGORIES.CONFIG_BLOCK) bucket.blocked++
      else if (category === ERROR_CATEGORIES.TIMEOUT || log.status === 'error') bucket.failed++
    }

    return { days, buckets }
  })
}
