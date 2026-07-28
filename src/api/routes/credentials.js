import dbDefault from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { getCredentialSaveMessage, parseCredentialData, PLATFORMS, sanitizeCredentialBody, validateCredentialData } from '../../credentialHealth.js'
import { isCookielessMode } from '../../credentialPrivacy.js'
import { encryptCredential } from '../../credentialCrypto.js'
import { checkMercadoLivreSession as defaultCheckMercadoLivreSession } from '../../converters/mercadolivre.js'
import { checkAmazonSession as defaultCheckAmazonSession } from '../../converters/amazon.js'
import { getCachedProbe as defaultGetCachedProbe, invalidateCachedProbe as defaultInvalidateCachedProbe, setCachedProbe as defaultSetCachedProbe } from '../../converters/amazonSessionProbeCache.js'
import { getCachedProbe as defaultGetCachedMlProbe, invalidateCachedProbe as defaultInvalidateCachedMlProbe, setCachedProbe as defaultSetCachedMlProbe } from '../../converters/mercadolivreSessionProbeCache.js'
import { getBotMetrics as defaultGetBotMetrics, isRunning as defaultIsRunning, reloadConfig as defaultReloadConfig, startBot as defaultStartBot, stopBot as defaultStopBot } from '../../manager.js'
import { classifyWorkerHealth } from '../../workerHealth.js'
import { restartStaleWorkerIfNeeded } from '../../workerRemediation.js'

export async function credentialsRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const checkMercadoLivreSession = opts.checkMercadoLivreSession ?? defaultCheckMercadoLivreSession
  const checkAmazonSession = opts.checkAmazonSession ?? defaultCheckAmazonSession
  const getCachedAmazonProbe = opts.getCachedProbe ?? defaultGetCachedProbe
  const setCachedAmazonProbe = opts.setCachedProbe ?? defaultSetCachedProbe
  const invalidateCachedAmazonProbe = opts.invalidateCachedProbe ?? defaultInvalidateCachedProbe
  const getCachedMlProbe = opts.getMlProbeCache ?? defaultGetCachedMlProbe
  const setCachedMlProbe = opts.setMlProbeCache ?? defaultSetCachedMlProbe
  const invalidateCachedMlProbe = opts.invalidateMlProbeCache ?? defaultInvalidateCachedMlProbe
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
  //
  // 005-ml-cookie-expiry (US3): sem cache, cada abertura do painel disparava
  // uma sondagem real ao ML — N aberturas = N chamadas, aumentando consumo de
  // rotação de cookie. Agora: (1) cache curto por usuário evita sondar de
  // novo dentro da janela TTL (espelha /amazon/session); (2) resultado
  // transitório (alive:null) nunca é servido do cache (mercadolivreSessionProbeCache.js
  // já filtra isso internamente).
  app.get('/mercadolivre/session', { onRequest: [app.authenticate] }, async (req) => {
    const cached = getCachedMlProbe(req.user.sub)
    if (cached) {
      app.log.debug({ userId: req.user.sub }, 'Mercado Livre session: sondagem servida por cache (sem chamada ao ML)')
      return cached
    }

    const cred = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'mercadolivre' } },
    })
    if (!cred) return { configured: false, alive: null, reason: 'not_configured' }
    const data = parseCredentialData(cred.data)
    // Modo sem cookie: não há sessão para sondar. Responder `cookieless_mode`
    // (em vez de sondar e devolver alive:false) evita o falso alarme "Sessão
    // expirada" no painel para quem escolheu deliberadamente não dar o SSID.
    if (isCookielessMode('mercadolivre', data)) {
      return { configured: false, alive: null, reason: 'cookieless_mode' }
    }
    const result = await checkMercadoLivreSession(data)
    app.log.debug({ userId: req.user.sub }, 'Mercado Livre session: sondagem efetiva (chamada real ao ML)')

    const { credentialPatch, ...publicResult } = result
    if (credentialPatch) {
      const patchedData = { ...data, ...credentialPatch }
      await db.credential.update({
        where: { userId_platform: { userId: req.user.sub, platform: 'mercadolivre' } },
        data: { data: encryptCredential(JSON.stringify(patchedData)) },
      })
    }

    const responseBody = { ...publicResult, checkedAt: new Date().toISOString() }
    // Só cacheia resultado definitivo (alive true/false) — mesmo contrato do
    // eixo Amazon (T023 do precedente): um blip transitório não pode fixar o
    // painel nesse estado pela janela inteira do TTL.
    if (responseBody.alive === true || responseBody.alive === false) {
      setCachedMlProbe(req.user.sub, responseBody)
    }
    return responseBody
  })

  // Checagem ativa da sessão de afiliado da Amazon (SiteStripe). Os cookies
  // expiram/rotacionam; sem renovar, o getShortUrl devolve a página "Acessar
  // Amazon" e as ofertas saem com o ?tag= longo em vez do amzn.to. O painel
  // chama este endpoint ao carregar e avisa a usuária quando expirado.
  //
  // 001-amazon-cookie-expiry: cada chamada real dispara um getShortUrl que
  // ROTACIONA o cookie de sessão. Sem persistir a rotação (esta rota não tem o
  // gancho __onCredentialPatch do worker/linkConversion) e sem cache, cada
  // reload do painel gastava uma rotação silenciosamente descartada — a sessão
  // morria cedo. Agora: (1) cache curto por usuário evita sondar de novo dentro
  // da janela TTL; (2) quando a sondagem ocorre e devolve credentialPatch, a
  // rota persiste cifrado (espelha o bloco de /mercadolivre/session acima).
  app.get('/amazon/session', { onRequest: [app.authenticate] }, async (req) => {
    const cached = getCachedAmazonProbe(req.user.sub)
    if (cached) {
      app.log.debug({ userId: req.user.sub }, 'Amazon session: sondagem servida por cache (sem chamada à Amazon)')
      return cached
    }

    const cred = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'amazon' } },
    })
    if (!cred) return { configured: false, alive: null, reason: 'not_configured' }
    const data = parseCredentialData(cred.data)
    // Mesmo contrato do ML acima: sem cookie cadastrado por escolha da usuária,
    // não existe sessão para expirar — nada a sondar, nada a alarmar.
    if (isCookielessMode('amazon', data)) {
      return { configured: false, alive: null, reason: 'cookieless_mode' }
    }
    const result = await checkAmazonSession(data)
    app.log.debug({ userId: req.user.sub }, 'Amazon session: sondagem efetiva (chamada real à Amazon)')

    const { credentialPatch, ...publicResult } = result
    if (credentialPatch) {
      const patchedData = { ...data, ...credentialPatch }
      await db.credential.update({
        where: { userId_platform: { userId: req.user.sub, platform: 'amazon' } },
        data: { data: encryptCredential(JSON.stringify(patchedData)) },
      })
    }

    const responseBody = { ...publicResult, checkedAt: new Date().toISOString() }
    // Só cacheia resultado definitivo (alive true/false). Estados indeterminados
    // (alive:null — ex.: network_error) não entram no cache: um único blip
    // transitório da Amazon não pode fixar o painel nesse estado pela janela
    // inteira do TTL, impedindo refletir a sessão realmente viva/expirada na
    // próxima abertura (T023, review de código).
    if (responseBody.alive === true || responseBody.alive === false) {
      setCachedAmazonProbe(req.user.sub, responseBody)
    }
    return responseBody
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
    if (platform === 'amazon') {
      // Sem isto, um cookie novo recadastrado pela usuária (fluxo de
      // renovação após expiração — US1/SC-004) continuava mascarado pelo
      // resultado antigo em GET /amazon/session (ex.: alive:false) até o
      // cache expirar sozinho (até AMAZON_SESSION_PROBE_CACHE_TTL_MS,
      // default 5min) (T022, review de código).
      invalidateCachedAmazonProbe(req.user.sub)
    }
    if (platform === 'mercadolivre') {
      // 005-ml-cookie-expiry (T016): mesmo padrão do Amazon — sem isto, uma
      // credencial ML recadastrada continuaria mascarada pelo resultado
      // antigo em GET /mercadolivre/session até o cache expirar sozinho.
      invalidateCachedMlProbe(req.user.sub)
    }
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

  // Apagar credencial da plataforma. Contrapartida do modo sem cookie: quem
  // desconfia de deixar cookie/tag guardados precisa de um botão que APAGUE de
  // verdade, na hora, sem abrir suporte. Idempotente — apagar o que já não
  // existe responde 200 com `deleted: false` (a usuária não precisa entender
  // 404 para saber que o dado não está mais lá).
  app.delete('/:platform', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { platform } = req.params
    if (!PLATFORMS.includes(platform)) return reply.code(400).send({ error: 'Plataforma inválida' })

    let deleted = false
    try {
      await db.credential.delete({ where: { userId_platform: { userId: req.user.sub, platform } } })
      deleted = true
    } catch (err) {
      // P2025 = registro inexistente no Prisma. Qualquer outro erro é real.
      if (err?.code !== 'P2025') throw err
    }

    if (platform === 'amazon') invalidateCachedAmazonProbe(req.user.sub)
    if (platform === 'mercadolivre') invalidateCachedMlProbe(req.user.sub)

    // Mesmo contrato do PUT: sem o reload, o worker seguiria convertendo com a
    // credencial apagada em cache (CONFIG_CACHE_TTL_MS, ~60s). Best-effort.
    let configReloaded = false
    let configReloadError = null
    try {
      configReloaded = Boolean(await reloadConfig(req.user.sub))
    } catch (err) {
      configReloadError = err?.message || 'Falha ao recarregar config do worker'
      app.log.warn({ platform, err: configReloadError }, 'Falha ao recarregar config do worker após apagar credencial')
    }

    app.log.info({ platform, deleted, configReloaded, configReloadError }, 'Credencial apagada a pedido da usuária')
    trackAnalyticsEventSafe({ userId: req.user.sub, event: 'credential_deleted', metadata: { platform, deleted } })
    return {
      platform,
      deleted,
      configReloaded,
      configReloadError,
      message: deleted
        ? 'Credencial apagada. Os dados dessa loja não estão mais guardados no BOTinho.'
        : 'Nenhuma credencial guardada para essa loja.',
    }
  })
}
