import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { getCredentialSaveMessage, parseCredentialData, PLATFORMS, sanitizeCredentialBody, validateCredentialData } from '../../credentialHealth.js'
import { encryptCredential } from '../../credentialCrypto.js'
import { checkMercadoLivreSession } from '../../converters/mercadolivre.js'
import { reloadConfig } from '../../manager.js'

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
    const { credentialPatch, ...publicResult } = result
    if (credentialPatch) {
      const patchedData = { ...data, ...credentialPatch }
      await db.credential.update({
        where: { userId_platform: { userId: req.user.sub, platform: 'mercadolivre' } },
        data: { data: encryptCredential(JSON.stringify(patchedData)) },
      })
    }
    return { ...publicResult, checkedAt: new Date().toISOString() }
  })

  app.put('/:platform', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { platform } = req.params
    if (!PLATFORMS.includes(platform)) return reply.code(400).send({ error: 'Plataforma inválida' })

    const sanitizedBody = sanitizeCredentialBody(platform, req.body)

    const validation = validateCredentialData(platform, sanitizedBody)
    if (validation.missing.length) {
      return reply.code(400).send({
        error: `Campos obrigatórios: ${validation.missing.join(', ')}`,
        validation,
      })
    }

    const encryptedData = encryptCredential(JSON.stringify(sanitizedBody))
    const cred = await db.credential.upsert({
      where: { userId_platform: { userId: req.user.sub, platform } },
      create: { userId: req.user.sub, platform, data: encryptedData },
      update: { data: encryptedData },
    })
    // Recarrega a config do worker imediatamente — sem isso, o bot usa a
    // credencial antiga em cache (CONFIG_CACHE_TTL_MS, ~60s) e ofertas novas
    // seguem saindo com a credencial expirada logo após a troca. Best-effort
    // (mesmo contrato de groups.js): só sinaliza, não bloqueia o save.
    const configReloaded = reloadConfig(req.user.sub)
    app.log.info({ platform, configReloaded }, 'Credencial salva; reload da config do worker solicitado')
    trackAnalyticsEventSafe({ userId: req.user.sub, event: 'credential_saved', metadata: { platform, status: validation.status } })
    return { ...cred, data: parseCredentialData(cred.data), validation, message: getCredentialSaveMessage(validation) }
  })
}
