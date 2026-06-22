import dbDefault from '../../db.js'
import { sendBroadcast, isRunning } from '../../manager.js'
import { enforceChannelPlanGate, loadUserPlanSubject, resolveTargetJids, validateBroadcastText } from './broadcastTargets.js'
import { ensureBroadcastRate, ensureCountQuota } from '../quotas.js'
import { beginIdempotent, extractIdempotencyKey } from '../idempotency.js'

function optionalUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^https?:\/\//i.test(normalized) ? normalized : null
}

function safeParseJids(value) {
  try {
    const parsed = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Rótulo amigável da origem de uma linha in-flight do MessageLog (espelho de
// grupo, envio manual, agendamento ou oferta automática). Mantém o mesmo
// vocabulário do histórico para o usuário não ver dois nomes pra mesma coisa.
function inflightSourceLabel(sourceGroup) {
  switch (sourceGroup) {
    case 'manual': return 'Envio manual'
    case 'scheduled': return 'Agendamento'
    case 'offerAutomation': return 'Oferta automática'
    default: return 'Espelhado'
  }
}

// Agrega as TRÊS fontes do "futuro" de um envio num formato único para o
// painel: agendamentos (ScheduledMessage), itens de fila (OfferQueueItem) e
// mensagens já no pipeline de envio (MessageLog status queued/sending — inclui
// espelhos de grupo jogados pra frente com delay). Cada item carrega `source`
// e o suficiente para a UI cancelar na rota certa.
async function loadUpcoming(db, userId) {
  const [scheduled, queueItems, inflight] = await Promise.all([
    db.scheduledMessage.findMany({
      where: { userId, status: { in: ['pending', 'queued'] } },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    }),
    db.offerQueueItem.findMany({
      where: { userId, status: { in: ['pending', 'queued'] } },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      take: 300,
      include: { queue: { select: { name: true, enabled: true } } },
    }),
    db.messageLog.findMany({
      where: { userId, status: { in: ['queued', 'sending'] } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    }),
  ])

  const inflightItems = inflight.map((row) => ({
    id: `log:${row.id}`,
    source: 'inflight',
    sourceLabel: inflightSourceLabel(row.sourceGroup),
    status: row.status,
    text: row.messageText || '',
    imageUrl: null,
    targetJids: row.destGroup ? [row.destGroup] : [],
    scheduledAt: null,
    position: null,
    lastError: null,
    paused: false,
    createdAt: row.sentAt,
    cancellable: false,
  }))

  const scheduledItems = scheduled.map((row) => ({
    id: `sched:${row.id}`,
    source: 'scheduled',
    sourceLabel: 'Agendada',
    status: row.status,
    text: row.text || '',
    imageUrl: row.imageUrl || null,
    targetJids: safeParseJids(row.targetJids),
    scheduledAt: row.scheduledAt,
    position: null,
    lastError: null,
    paused: false,
    createdAt: row.createdAt,
    cancellable: row.status === 'pending',
    cancel: { kind: 'scheduled', id: row.id },
  }))

  const queueItemRows = queueItems.map((row) => ({
    id: `queue:${row.id}`,
    source: 'queue',
    sourceLabel: row.queue?.name ? `Fila: ${row.queue.name}` : 'Fila',
    status: row.status,
    text: row.text || '',
    imageUrl: row.imageUrl || null,
    targetJids: safeParseJids(row.targetJids),
    scheduledAt: null,
    position: row.position,
    lastError: row.lastError || null,
    paused: row.queue ? row.queue.enabled === false : false,
    createdAt: row.createdAt,
    cancellable: row.status === 'pending',
    cancel: { kind: 'queueItem', queueId: row.queueId, id: row.id },
  }))

  // Ordem: o que está saindo agora (in-flight) primeiro, depois agendamentos
  // por horário, e por fim os itens de fila na ordem de posição.
  return [...inflightItems, ...scheduledItems, ...queueItemRows]
}

function countBySource(items) {
  const counts = { inflight: 0, scheduled: 0, queue: 0 }
  for (const item of items) if (item.source in counts) counts[item.source] += 1
  return counts
}

export async function broadcastRoutes(app, deps = {}) {
  const db = deps.db ?? dbDefault
  const sendBroadcastImpl = deps.sendBroadcast ?? sendBroadcast
  const isRunningImpl = deps.isRunning ?? isRunning
  const now = deps.now ?? (() => new Date())

  app.post('/send', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, jids, imageUrl, imageRefererUrl } = req.body ?? {}
    if (!text?.trim()) return reply.code(400).send({ error: 'text obrigatório' })
    validateBroadcastText(text)

    // Idempotency opcional: um retry de rede com a mesma chave devolve a
    // resposta anterior em vez de reexecutar o fan-out. Aplicado antes do
    // rate limit para que o replay não consuma o orçamento de envios.
    const idemKey = extractIdempotencyKey(req)
    const idem = beginIdempotent(userId, idemKey)
    if (idem.replay) return idem.result
    if (idem.inFlight) return reply.code(409).send({ error: 'Requisição com a mesma Idempotency-Key ainda em processamento' })

    if (!ensureBroadcastRate(reply, userId)) { idem.release(); return }
    if (!await isRunningImpl(userId)) { idem.release(); return reply.code(400).send({ error: 'Bot não está conectado' }) }

    let targetJids
    try {
      targetJids = await resolveTargetJids({ db, userId, jids })
    } catch (err) {
      idem.release()
      throw err
    }
    const gateError = enforceChannelPlanGate(targetJids, await loadUserPlanSubject(db, userId))
    if (gateError) { idem.release(); return reply.code(403).send(gateError) }
    if (!targetJids.length) { idem.release(); return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' }) }

    try {
      const result = await sendBroadcastImpl(userId, text.trim(), targetJids, {
        imageUrl: optionalUrl(imageUrl) ?? undefined,
        imageRefererUrl: optionalUrl(imageRefererUrl) ?? undefined,
      })
      idem.commit(result)
      return result
    } catch (err) {
      idem.release()
      throw err
    }
  })

  app.get('/scheduled', { onRequest: [app.authenticate] }, async (req) => {
    const msgs = await db.scheduledMessage.findMany({
      where: { userId: req.user.sub, status: { in: ['pending', 'queued'] } },
      orderBy: { scheduledAt: 'asc' },
    })
    return msgs.map((message) => ({ ...message, targetJids: JSON.parse(message.targetJids) }))
  })

  // Visão unificada do "futuro": agendamentos + itens de fila + mensagens
  // ainda no pipeline de envio, num só lugar (painel "Próximos envios").
  app.get('/upcoming', { onRequest: [app.authenticate] }, async (req) => {
    const items = await loadUpcoming(db, req.user.sub)
    return { items, counts: countBySource(items) }
  })

  app.post('/scheduled', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { text, scheduledAt, jids, imageUrl, imageRefererUrl } = req.body ?? {}
    if (!text?.trim() || !scheduledAt) return reply.code(400).send({ error: 'text e scheduledAt obrigatórios' })
    validateBroadcastText(text)
    if (!(await ensureCountQuota(reply, {
      userId,
      quota: 'pendingScheduledPerUser',
      count: () => db.scheduledMessage.count({ where: { userId, status: 'pending' } }),
      label: 'mensagens agendadas pendentes',
    }))) return

    const schedDate = new Date(scheduledAt)
    if (Number.isNaN(schedDate.getTime()) || schedDate <= now()) {
      return reply.code(400).send({ error: 'scheduledAt deve ser uma data futura válida' })
    }

    const targetJids = await resolveTargetJids({ db, userId, jids })
    const gateError = enforceChannelPlanGate(targetJids, await loadUserPlanSubject(db, userId))
    if (gateError) return reply.code(403).send(gateError)
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' })

    return db.scheduledMessage.create({
      data: {
        userId,
        text: text.trim(),
        targetJids: JSON.stringify(targetJids),
        scheduledAt: schedDate,
        imageUrl: optionalUrl(imageUrl),
        imageRefererUrl: optionalUrl(imageRefererUrl),
      },
    })
  })

  app.delete('/scheduled/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const cancelled = await db.scheduledMessage.updateMany({
      where: { id: req.params.id, userId: req.user.sub, status: 'pending' },
      data: { status: 'cancelled' },
    })
    if (cancelled.count === 1) return { ok: true }

    const existing = await db.scheduledMessage.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
      select: { status: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Mensagem agendada não encontrada' })

    return reply.code(409).send({
      error: 'Somente agendamentos pendentes podem ser cancelados',
      status: existing.status,
    })
  })
}
