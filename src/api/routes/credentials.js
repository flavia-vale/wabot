import db from '../../db.js'

const PLATFORMS = ['shopee', 'amazon', 'mercadolivre', 'magazineluiza']

export async function credentialsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const creds = await db.credential.findMany({ where: { userId: req.user.sub } })
    return creds.map(c => ({ ...c, data: JSON.parse(c.data) }))
  })

  app.put('/:platform', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { platform } = req.params
    if (!PLATFORMS.includes(platform)) return reply.code(400).send({ error: 'Plataforma inválida' })

    const cred = await db.credential.upsert({
      where: { userId_platform: { userId: req.user.sub, platform } },
      create: { userId: req.user.sub, platform, data: JSON.stringify(req.body) },
      update: { data: JSON.stringify(req.body) },
    })
    return { ...cred, data: JSON.parse(cred.data) }
  })
}
