import db from '../../db.js'
import { PUBLIC_ANALYTICS_EVENTS, sanitizeAnalyticsMetadata, trackAnalyticsEvent, trackAnalyticsEventSafe } from '../../analytics.js'


const publicAnalyticsAttempts = new Map()
const PUBLIC_ANALYTICS_RATE_WINDOW_MS = 10 * 60 * 1000
const PUBLIC_ANALYTICS_RATE_LIMIT = 60

export function normalizePublicAnalyticsMetadata(metadata = {}) {
  const safe = sanitizeAnalyticsMetadata(metadata)
  const pagePath = safe.page_path || safe.pathname || ''
  return {
    ...safe,
    ...(pagePath ? { page_path: String(pagePath).slice(0, 120) } : {}),
  }
}

export function consumePublicAnalyticsAttempt({ ip = 'unknown', now = Date.now() } = {}) {
  const key = String(ip || 'unknown').slice(0, 80)
  const current = publicAnalyticsAttempts.get(key)
  if (!current || now > current.resetAt) {
    const next = { count: 1, resetAt: now + PUBLIC_ANALYTICS_RATE_WINDOW_MS }
    publicAnalyticsAttempts.set(key, next)
    return { blocked: false, remaining: PUBLIC_ANALYTICS_RATE_LIMIT - 1, resetAt: next.resetAt }
  }

  current.count += 1
  if (current.count > PUBLIC_ANALYTICS_RATE_LIMIT) return { blocked: true, remaining: 0, resetAt: current.resetAt }
  return { blocked: false, remaining: Math.max(PUBLIC_ANALYTICS_RATE_LIMIT - current.count, 0), resetAt: current.resetAt }
}

export function clearPublicAnalyticsAttempts() {
  publicAnalyticsAttempts.clear()
}

function serializeFaqItem(item) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    position: item.position,
  }
}

function assertFaqShape(items = []) {
  if (!Array.isArray(items)) throw new Error('FAQ payload inválido: esperado array.')
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`FAQ payload inválido no índice ${index}: esperado objeto.`)
    if (!item.id || !item.question || !item.answer) throw new Error(`FAQ payload inválido no índice ${index}: campos obrigatórios ausentes.`)
    return {
      id: String(item.id),
      question: String(item.question),
      answer: String(item.answer),
      position: Number(item.position ?? 0),
    }
  })
}

function parsePlanFeatures(rawFeatures) {
  try {
    const parsed = JSON.parse(String(rawFeatures ?? '[]'))
    return Array.isArray(parsed) ? parsed.map(item => String(item).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

function serializeLpPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    price: plan.price,
    features: parsePlanFeatures(plan.features),
    position: plan.position,
  }
}

function assertPlanShape(plans = []) {
  if (!Array.isArray(plans)) throw new Error('Plans payload inválido: esperado array.')
  return plans.map((plan, index) => {
    if (!plan || typeof plan !== 'object') throw new Error(`Plans payload inválido no índice ${index}: esperado objeto.`)
    if (!plan.id || !plan.title) throw new Error(`Plans payload inválido no índice ${index}: id/title obrigatórios.`)
    return {
      id: String(plan.id),
      title: String(plan.title),
      description: String(plan.description ?? ''),
      price: String(plan.price ?? ''),
      features: Array.isArray(plan.features) ? plan.features.map((f) => String(f)) : [],
      position: Number(plan.position ?? 0),
    }
  })
}

function safeShapeOrFallback({ label, factory, fallback = [] }) {
  try {
    return factory()
  } catch (err) {
    console.error(`[publicRoutes] ${label}:`, err?.message || err)
    return fallback
  }
}

async function handlePublicAnalytics(req, reply, { includeVersion = false } = {}) {
  const attempt = consumePublicAnalyticsAttempt({ ip: req.ip })
  if (attempt.blocked) {
    trackAnalyticsEventSafe({
      event: 'public_analytics_blocked_429',
      metadata: { route: req.routeOptions?.url || '/api/public/analytics' },
    })
    const retryAfter = Math.max(1, Math.ceil((attempt.resetAt - Date.now()) / 1000))
    reply.header('Retry-After', String(retryAfter))
    return reply.code(429).send({ error: 'Muitos eventos. Tente novamente mais tarde.' })
  }

  const { event, metadata = {} } = req.body ?? {}
  if (!PUBLIC_ANALYTICS_EVENTS.has(event)) {
    trackAnalyticsEventSafe({
      event: 'public_analytics_invalid_event',
      metadata: { route: req.routeOptions?.url || '/api/public/analytics' },
    })
    return reply.code(400).send({ error: 'Evento público inválido' })
  }
  await trackAnalyticsEvent({ event, metadata: normalizePublicAnalyticsMetadata(metadata, req) })
  trackAnalyticsEventSafe({
    event: 'public_analytics_accepted',
    metadata: { route: req.routeOptions?.url || '/api/public/analytics', public_event: String(event).slice(0, 80) },
  })
  return reply.code(202).send(includeVersion ? { ok: true, version: 'v1' } : { ok: true })
}

async function getActiveFaqItems() {
  return db.faqItem.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
}

async function getLpPlans() {
  try {
    return await db.lpPlan.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
  } catch (err) {
    const message = String(err?.message ?? '')
    const knownSchemaError =
      message.includes('no such table') ||
      message.includes('does not exist in the current database') ||
      message.includes('Unknown field') ||
      message.includes('Unknown argument')

    if (knownSchemaError) return []
    throw err
  }
}

async function getTutorialContent() {
  try {
    if (!db.tutorialContent || typeof db.tutorialContent.findUnique !== 'function') return null
    const tutorial = await db.tutorialContent.findUnique({ where: { id: 'dashboard_tutorial' } })
    if (!tutorial) return null
    let images = []
    try { images = JSON.parse(String(tutorial.images ?? '[]')) } catch {}
    return { ...tutorial, images: Array.isArray(images) ? images : [] }
  } catch {
    return null
  }
}

export async function publicRoutes(app) {
  app.get('/v1/faq', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const items = await getActiveFaqItems()
    return { version: 'v1', items: safeShapeOrFallback({ label: 'v1/faq shape', factory: () => assertFaqShape(items.map(serializeFaqItem)) }) }
  })

  app.get('/faq', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const items = await getActiveFaqItems()

    return { items: safeShapeOrFallback({ label: 'faq shape', factory: () => assertFaqShape(items.map(serializeFaqItem)) }) }
  })

  app.get('/v1/lp-content', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const [plans, faqItems, tutorial] = await Promise.all([getLpPlans(), getActiveFaqItems(), getTutorialContent()])
    return {
      version: 'v1',
      plans: safeShapeOrFallback({ label: 'v1/lp-content plans shape', factory: () => assertPlanShape(plans.map(serializeLpPlan)) }),
      faq: safeShapeOrFallback({ label: 'v1/lp-content faq shape', factory: () => assertFaqShape(faqItems.map(serializeFaqItem)) }),
      tutorial: tutorial ?? null,
    }
  })

  app.get('/lp-content', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const [plans, faqItems, tutorial] = await Promise.all([getLpPlans(), getActiveFaqItems(), getTutorialContent()])

    return {
      plans: safeShapeOrFallback({ label: 'lp-content plans shape', factory: () => assertPlanShape(plans.map(serializeLpPlan)) }),
      faq: safeShapeOrFallback({ label: 'lp-content faq shape', factory: () => assertFaqShape(faqItems.map(serializeFaqItem)) }),
      tutorial,
    }
  })

  app.get('/v1/tutorial-content', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const tutorial = await getTutorialContent()
    return { version: 'v1', tutorial: tutorial ?? null }
  })

  app.get('/tutorial-content', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const tutorial = await getTutorialContent()
    return { tutorial }
  })


  app.post('/analytics', async (req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    return handlePublicAnalytics(req, reply)
  })

  app.post('/v1/analytics', async (req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    return handlePublicAnalytics(req, reply, { includeVersion: true })
  })

  app.get('/v1/plans', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const plans = await getLpPlans()
    return { version: 'v1', plans: safeShapeOrFallback({ label: 'v1/plans shape', factory: () => assertPlanShape(plans.map(serializeLpPlan)) }) }
  })

  app.get('/plans', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const plans = await getLpPlans()

    return { plans: safeShapeOrFallback({ label: 'plans shape', factory: () => assertPlanShape(plans.map(serializeLpPlan)) }) }
  })
}
