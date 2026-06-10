import dbDefault from '../../db.js'
import { enforceChannelPlanGate, loadUserPlanSubject, resolveTargetJids } from './broadcastTargets.js'
import { startOfSaoPauloDayUtc } from '../../offerQueue/time.js'

const DEFAULTS = { intervalMinutes: 30, hourlyCap: 10, dailyCap: 50 }

function queueData(body = {}, partial = false) {
  const data = {}
  const fields = ['name', 'enabled', 'intervalEnabled', 'intervalMinutes', 'hourlyCapEnabled', 'hourlyCap', 'dailyCapEnabled', 'dailyCap']
  for (const field of fields) if (body[field] !== undefined) data[field] = body[field]
  if (!partial) Object.assign(data, { enabled: body.enabled ?? true, intervalEnabled: body.intervalEnabled ?? false, intervalMinutes: body.intervalMinutes ?? DEFAULTS.intervalMinutes, hourlyCapEnabled: body.hourlyCapEnabled ?? false, hourlyCap: body.hourlyCap ?? DEFAULTS.hourlyCap, dailyCapEnabled: body.dailyCapEnabled ?? false, dailyCap: body.dailyCap ?? DEFAULTS.dailyCap })
  if ('name' in data) data.name = typeof data.name === 'string' ? data.name.trim() : ''
  for (const field of ['intervalMinutes', 'hourlyCap', 'dailyCap']) if (field in data) data[field] = Number(data[field])
  return data
}

function validateQueue(data, current = {}) {
  const merged = { ...current, ...data }
  if (!merged.name) return 'Nome da fila é obrigatório'
  for (const [toggle, value, label] of [['intervalEnabled', 'intervalMinutes', 'Intervalo'], ['hourlyCapEnabled', 'hourlyCap', 'Limite por hora'], ['dailyCapEnabled', 'dailyCap', 'Limite por dia']]) {
    if (merged[toggle] && (!Number.isInteger(merged[value]) || merged[value] < 1)) return `${label} deve ser um número inteiro maior ou igual a 1`
  }
  return null
}

function optionalUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^https?:\/\//i.test(normalized) ? normalized : null
}

export async function offerQueueRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const now = opts.now ?? (() => new Date())

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const queues = await db.offerQueue.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    const dayStart = startOfSaoPauloDayUtc(now())
    return Promise.all(queues.map(async (queue) => ({
      ...queue,
      pendingCount: await db.offerQueueItem.count({ where: { userId, queueId: queue.id, status: 'pending' } }),
      sentTodayCount: await db.offerQueueItem.count({ where: { userId, queueId: queue.id, status: 'sent', sentAt: { gte: dayStart } } }),
    })))
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const data = queueData(req.body)
    const error = validateQueue(data)
    if (error) return reply.code(400).send({ error })
    return db.offerQueue.create({ data: { ...data, userId: req.user.sub } })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const current = await db.offerQueue.findFirst({ where: { id: req.params.id, userId } })
    if (!current) return reply.code(404).send({ error: 'Fila não encontrada' })
    const data = queueData(req.body, true)
    const error = validateQueue(data, current)
    if (error) return reply.code(400).send({ error })
    await db.offerQueue.updateMany({ where: { id: current.id, userId }, data })
    return db.offerQueue.findFirst({ where: { id: current.id, userId } })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = await db.offerQueue.deleteMany({ where: { id: req.params.id, userId: req.user.sub } })
    if (!result.count) return reply.code(404).send({ error: 'Fila não encontrada' })
    return { ok: true }
  })

  app.get('/:id/items', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const queue = await db.offerQueue.findFirst({ where: { id: req.params.id, userId }, select: { id: true } })
    if (!queue) return reply.code(404).send({ error: 'Fila não encontrada' })
    const items = await db.offerQueueItem.findMany({ where: { queueId: queue.id, userId }, orderBy: [{ status: 'asc' }, { position: 'asc' }] })
    return items.map((item) => ({ ...item, targetJids: JSON.parse(item.targetJids) }))
  })

  app.post('/:id/items', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const queue = await db.offerQueue.findFirst({ where: { id: req.params.id, userId }, select: { id: true } })
    if (!queue) return reply.code(404).send({ error: 'Fila não encontrada' })
    const { text, jids, imageUrl, imageRefererUrl } = req.body ?? {}
    if (!text?.trim()) return reply.code(400).send({ error: 'text obrigatório' })
    const targetJids = await resolveTargetJids({ db, userId, jids })
    const gateError = enforceChannelPlanGate(targetJids, await loadUserPlanSubject(db, userId))
    if (gateError) return reply.code(403).send(gateError)
    if (!targetJids.length) return reply.code(400).send({ error: 'Nenhum grupo/canal de destino configurado' })
    const last = await db.offerQueueItem.findFirst({ where: { queueId: queue.id, userId }, orderBy: { position: 'desc' }, select: { position: true } })
    return db.offerQueueItem.create({ data: { queueId: queue.id, userId, text: text.trim(), imageUrl: optionalUrl(imageUrl), imageRefererUrl: optionalUrl(imageRefererUrl), targetJids: JSON.stringify(targetJids), position: (last?.position ?? 0) + 1 } })
  })

  app.delete('/:id/items/:itemId', { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = await db.offerQueueItem.updateMany({ where: { id: req.params.itemId, queueId: req.params.id, userId: req.user.sub, status: 'pending' }, data: { status: 'cancelled' } })
    if (!result.count) return reply.code(404).send({ error: 'Item pendente não encontrado' })
    return { ok: true }
  })
}
