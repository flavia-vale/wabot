import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { getCredentialSaveMessage, parseCredentialData, PLATFORMS, validateCredentialData } from '../../credentialHealth.js'

export async function credentialsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const creds = await db.credential.findMany({ where: { userId: req.user.sub } })
    return creds.map(c => {
      const data = parseCredentialData(c.data)
      return { ...c, data, validation: validateCredentialData(c.platform, data) }
    })
  })

  app.put('/:platform', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { platform } = req.params
    if (!PLATFORMS.includes(platform)) return reply.code(400).send({ error: 'Plataforma inválida' })

    const validation = validateCredentialData(platform, req.body)
    if (validation.missing.length) {
      return reply.code(400).send({
        error: `Campos obrigatórios: ${validation.missing.join(', ')}`,
        validation,
      })
    }

    const cred = await db.credential.upsert({
      where: { userId_platform: { userId: req.user.sub, platform } },
      create: { userId: req.user.sub, platform, data: JSON.stringify(req.body) },
      update: { data: JSON.stringify(req.body) },
    })
    trackAnalyticsEventSafe({ userId: req.user.sub, event: 'credential_saved', metadata: { platform, status: validation.status } })
    return { ...cred, data: parseCredentialData(cred.data), validation, message: getCredentialSaveMessage(validation) }
  })
}
