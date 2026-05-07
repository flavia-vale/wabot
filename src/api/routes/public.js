import db from '../../db.js'

function serializeFaqItem(item) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    position: item.position,
  }
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

export async function publicRoutes(app) {
  app.get('/faq', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const items = await getActiveFaqItems()

    return { items: items.map(serializeFaqItem) }
  })

  app.get('/lp-content', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const [plans, faqItems] = await Promise.all([getLpPlans(), getActiveFaqItems()])

    return {
      plans: plans.map(serializeLpPlan),
      faq: faqItems.map(serializeFaqItem),
    }
  })

  app.get('/plans', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const plans = await getLpPlans()

    return { plans: plans.map(serializeLpPlan) }
  })
}
