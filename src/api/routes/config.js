import db from '../../db.js'
import { reloadConfig } from '../../manager.js'
import { normalizeBrandingLink } from '../../messageProcessor.js'

const DEFAULTS = {
  delayMin: 5,
  delayMax: 15,
  platforms: 'shopee,amazon,mercadolivre,magazineluiza',
  blockedKeywords: '',
  welcomeMsg: '',
  feedGlobal: false,
  postToStatus: false,
  brandingGroupLink: '',
}

function isIntegerInRange(value) {
  return Number.isInteger(value) && value >= 0 && value <= 300
}

export async function configRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    return cfg ?? { ...DEFAULTS, userId: req.user.sub }
  })

  app.put('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { delayMin, delayMax, platforms, blockedKeywords, welcomeMsg, feedGlobal, postToStatus, brandingGroupLink } = req.body ?? {}

    if (delayMin !== undefined && !isIntegerInRange(delayMin)) {
      return reply.code(400).send({ error: 'delayMin deve ser um número inteiro entre 0 e 300' })
    }
    if (delayMax !== undefined && !isIntegerInRange(delayMax)) {
      return reply.code(400).send({ error: 'delayMax deve ser um número inteiro entre 0 e 300' })
    }
    if (feedGlobal !== undefined && typeof feedGlobal !== 'boolean') {
      return reply.code(400).send({ error: 'feedGlobal deve ser boolean' })
    }
    if (postToStatus !== undefined && typeof postToStatus !== 'boolean') {
      return reply.code(400).send({ error: 'postToStatus deve ser boolean' })
    }
    const rawBrandingGroupLink = String(brandingGroupLink ?? '').trim()
    const normalizedBrandingGroupLink = normalizeBrandingLink(rawBrandingGroupLink)
    if (brandingGroupLink !== undefined && rawBrandingGroupLink && !normalizedBrandingGroupLink) {
      return reply.code(400).send({ error: 'Informe um link válido começando com http:// ou https://' })
    }

    const existing = await db.botConfig.findUnique({ where: { userId } })
    const nextDelayMin = delayMin ?? existing?.delayMin ?? DEFAULTS.delayMin
    const nextDelayMax = delayMax ?? existing?.delayMax ?? DEFAULTS.delayMax
    if (nextDelayMin > nextDelayMax) {
      return reply.code(400).send({ error: 'delayMin não pode ser maior que delayMax' })
    }

    const cfg = await db.botConfig.upsert({
      where: { userId },
      create: {
        userId,
        delayMin: delayMin ?? DEFAULTS.delayMin,
        delayMax: delayMax ?? DEFAULTS.delayMax,
        platforms: platforms ?? DEFAULTS.platforms,
        blockedKeywords: blockedKeywords ?? '',
        welcomeMsg: welcomeMsg ?? '',
        feedGlobal: feedGlobal ?? DEFAULTS.feedGlobal,
        postToStatus: postToStatus ?? DEFAULTS.postToStatus,
        brandingGroupLink: normalizedBrandingGroupLink,
      },
      update: {
        ...(delayMin !== undefined && { delayMin }),
        ...(delayMax !== undefined && { delayMax }),
        ...(platforms !== undefined && { platforms }),
        ...(blockedKeywords !== undefined && { blockedKeywords }),
        ...(welcomeMsg !== undefined && { welcomeMsg }),
        ...(feedGlobal !== undefined && { feedGlobal }),
        ...(postToStatus !== undefined && { postToStatus }),
        ...(brandingGroupLink !== undefined && { brandingGroupLink: normalizedBrandingGroupLink }),
      },
    })
    reloadConfig(userId)
    return cfg
  })
}
