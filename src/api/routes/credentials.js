import db from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { getCredentialSaveMessage, parseCredentialData, PLATFORMS, sanitizeCredentialBody, validateCredentialData } from '../../credentialHealth.js'
import { encryptCredential } from '../../credentialCrypto.js'
import { checkMercadoLivreSession } from '../../converters/mercadolivre.js'
import { checkAmazonSession } from '../../converters/amazon.js'
import { getBotMetrics as defaultGetBotMetrics, isRunning as defaultIsRunning, reloadConfig as defaultReloadConfig, startBot as defaultStartBot, stopBot as defaultStopBot } from '../../manager.js'
import { classifyWorkerHealth } from '../../workerHealth.js'
import { restartStaleWorkerIfNeeded } from '../../workerRemediation.js'

export async function credentialsRoutes(app, opts = {}) {
  const reloadConfig = opts.reloadConfig ?? defaultReloadConfig
  const getBotMetrics = opts.getBotMetrics ?? defaultGetBotMetrics
  const restartStaleWorker = opts.restartStaleWorker ?? ((args) => restartStaleWorkerIfNeeded({
    ...args,
    stopBot: defaultStopBot,
    startBot: defaultStartBot,
    isRunning: defaultIsRunning,
  }))
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

  // Checagem ativa da sessão de afiliado da Amazon (SiteStripe). Os cookies
  // expiram/rotacionam; sem renovar, o getShortUrl devolve a página "Acessar
  // Amazon" e as ofertas saem com o ?tag= longo em vez do amzn.to. O painel
  // chama este endpoint ao carregar e avisa a usuária quando expirado.
  app.get('/amazon/session', { onRequest: [app.authenticate] }, async (req) => {
    const cred = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'amazon' } },
    })
    if (!cred) return { configured: false, alive: null, reason: 'not_configured' }
    const data = parseCredentialData(cred.data)
    const result = await checkAmazonSession(data)
    return { ...result, checkedAt: new Date().toISOString() }
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
    let configReloaded = false
    let configReloadError = null
    try {
      configReloaded = Boolean(await reloadConfig(req.user.sub))
    } catch (err) {
      configReloadError = err?.message || 'Falha ao recarregar config do worker'
      app.log.warn({ platform, err: configReloadError }, 'Falha ao recarregar config do worker após salvar credencial')
    }
    let workerMetrics = null
    let workerMetricsError = null
    try {
      workerMetrics = await getBotMetrics(req.user.sub)
    } catch (err) {
      workerMetricsError = err?.message || 'Falha ao buscar métricas do worker'
    }
    const workerHealth = classifyWorkerHealth(workerMetrics)
    let workerRestart = { attempted: false, reason: 'worker_health_unknown' }
    let workerRestartError = null
    try {
      workerRestart = await restartStaleWorker({ userId: req.user.sub, platform, workerHealth })
    } catch (err) {
      workerRestartError = err?.message || 'Falha ao reiniciar worker desatualizado'
      app.log.warn({ platform, err: workerRestartError, workerHealth }, 'Falha ao remediar worker desatualizado após salvar credencial')
    }
    app.log.info({ platform, configReloaded, configReloadError, workerHealth, workerMetricsError, workerRestart, workerRestartError }, 'Credencial salva; reload da config do worker solicitado')
    trackAnalyticsEventSafe({ userId: req.user.sub, event: 'credential_saved', metadata: { platform, status: validation.status } })
    return { ...cred, data: parseCredentialData(cred.data), validation, message: getCredentialSaveMessage(validation), configReloaded, configReloadError, workerHealth, workerMetricsError, workerRestart, workerRestartError }
  })
}
