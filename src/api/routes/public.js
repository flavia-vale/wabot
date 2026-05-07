import db from '../../db.js'

function serializeFaqItem(item) {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    position: item.position,
  }
}

export async function publicRoutes(app) {
  app.get('/faq', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0')
    const items = await db.faqItem.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })

    return { items: items.map(serializeFaqItem) }
  })
}
