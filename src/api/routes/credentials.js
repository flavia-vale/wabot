import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { getCredentialSaveMessage, parseCredentialData, PLATFORMS, validateCredentialData } from '../../credentialHealth.js'
import { encryptCredential } from '../../credentialCrypto.js'
import { checkMercadoLivreSession } from '../../converters/mercadolivre.js'

export async function credentialsRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const creds = await db.credential.findMany({ where: { userId: req.user.sub } })
    return creds.map(c => {
      const data = parseCredentialData(c.data)
      return { ...c, data, validation: validateCredentialData(c.platform, data) }
    })
  })

  // Checagem ativa da sessão de afiliado do Mercado Livre. O cookie ssid expira
  // (dias/semanas) e, sem renovar, a raspagem/conversão do ML quebra em silêncio.
  // O painel chama este endpoint ao carregar e avisa a usuária quando expirado.
  app.get('/mercadolivre/session', { onRequest: [app.authenticate] }, async (req) => {
    const cred = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'mercadolivre' } },
    })
    if (!cred) return { configured: false, alive: null, reason: 'not_configured' }
    const data = parseCredentialData(cred.data)
    const result = await checkMercadoLivreSession(data)
    return { ...result, checkedAt: new Date().toISOString() }
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

    const encryptedData = encryptCredential(JSON.stringify(req.body))
    const cred = await db.credential.upsert({
      where: { userId_platform: { userId: req.user.sub, platform } },
      create: { userId: req.user.sub, platform, data: encryptedData },
      update: { data: encryptedData },
    })
    trackAnalyticsEventSafe({ userId: req.user.sub, event: 'credential_saved', metadata: { platform, status: validation.status } })
    return { ...cred, data: parseCredentialData(cred.data), validation, message: getCredentialSaveMessage(validation) }
  })
}
