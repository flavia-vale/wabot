import db from '../../db.js'

function serializeFaqItem(item) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    position: item.position,
  }
}

function serializeLpPlan(plan) {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    price: plan.price,
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
  return db.lpPlan.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
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
