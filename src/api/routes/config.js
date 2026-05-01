import db from '../../db.js'
import { reloadConfig } from '../../manager.js'

const DEFAULTS = {
  delayMin: 5,
  delayMax: 15,
  platforms: 'shopee,amazon,mercadolivre,magazineluiza',
  blockedKeywords: '',
  welcomeMsg: '',
}

export async function configRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    return cfg ?? { ...DEFAULTS, userId: req.user.sub }
  })

  app.put('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { delayMin, delayMax, platforms, blockedKeywords, welcomeMsg } = req.body ?? {}
    if (delayMin !== undefined && (delayMin < 0 || delayMin > 300))
      return reply.code(400).send({ error: 'delayMin deve ser entre 0 e 300' })
    if (delayMax !== undefined && (delayMax < 0 || delayMax > 300))
      return reply.code(400).send({ error: 'delayMax deve ser entre 0 e 300' })
    if (delayMin !== undefined && delayMax !== undefined && delayMin > delayMax)
      return reply.code(400).send({ error: 'delayMin não pode ser maior que delayMax' })
    const cfg = await db.botConfig.upsert({
      where: { userId },
      create: {
        userId,
        delayMin: delayMin ?? DEFAULTS.delayMin,
        delayMax: delayMax ?? DEFAULTS.delayMax,
        platforms: platforms ?? DEFAULTS.platforms,
        blockedKeywords: blockedKeywords ?? '',
        welcomeMsg: welcomeMsg ?? '',
      },
      update: {
        ...(delayMin !== undefined && { delayMin }),
        ...(delayMax !== undefined && { delayMax }),
        ...(platforms !== undefined && { platforms }),
        ...(blockedKeywords !== undefined && { blockedKeywords }),
        ...(welcomeMsg !== undefined && { welcomeMsg }),
      },
    })
    reloadConfig(userId)
    return cfg
  })
}
