import dbDefault from '../../db.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { getCredentialSaveMessage, parseCredentialData, PLATFORMS, sanitizeCredentialBody, validateCredentialData } from '../../credentialHealth.js'
import { encryptCredential } from '../../credentialCrypto.js'
import { checkMercadoLivreSession as defaultCheckMercadoLivreSession } from '../../converters/mercadolivre.js'
import { checkAmazonSession as defaultCheckAmazonSession } from '../../converters/amazon.js'
import { checkShopeeSession as defaultCheckShopeeSession } from '../../converters/shopee.js'
import { getCachedProbe as defaultGetCachedProbe, invalidateCachedProbe as defaultInvalidateCachedProbe, setCachedProbe as defaultSetCachedProbe } from '../../converters/amazonSessionProbeCache.js'
import { getCachedProbe as defaultGetCachedMlProbe, invalidateCachedProbe as defaultInvalidateCachedMlProbe, setCachedProbe as defaultSetCachedMlProbe } from '../../converters/mercadolivreSessionProbeCache.js'
import { getBotMetrics as defaultGetBotMetrics, isRunning as defaultIsRunning, reloadConfig as defaultReloadConfig, startBot as defaultStartBot, stopBot as defaultStopBot } from '../../manager.js'
import { describeSaveSessionCheck, platformSupportsSessionCheck } from '../../credentialSaveCheck.js'
import { classifyWorkerHealth } from '../../workerHealth.js'
import { restartStaleWorkerIfNeeded } from '../../workerRemediation.js'
import { extractSheinAffiliateId, isSheinShortLink, resolveSheinShortLink as defaultResolveSheinShortLink } from '../../converters/shein.js'

export async function credentialsRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const checkMercadoLivreSession = opts.checkMercadoLivreSession ?? defaultCheckMercadoLivreSession
  const checkAmazonSession = opts.checkAmazonSession ?? defaultCheckAmazonSession
  const checkShopeeSession = opts.checkShopeeSession ?? defaultCheckShopeeSession
  const getCachedAmazonProbe = opts.getCachedProbe ?? defaultGetCachedProbe
  const setCachedAmazonProbe = opts.setCachedProbe ?? defaultSetCachedProbe
  const invalidateCachedAmazonProbe = opts.invalidateCachedProbe ?? defaultInvalidateCachedProbe
  const getCachedMlProbe = opts.getMlProbeCache ?? defaultGetCachedMlProbe
  const setCachedMlProbe = opts.setMlProbeCache ?? defaultSetCachedMlProbe
  const invalidateCachedMlProbe = opts.invalidateMlProbeCache ?? defaultInvalidateCachedMlProbe
  const reloadConfig = opts.reloadConfig ?? defaultReloadConfig
  const getBotMetrics = opts.getBotMetrics ?? defaultGetBotMetrics
  const resolveSheinShortLink = opts.resolveSheinShortLink ?? defaultResolveSheinShortLink
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

  // Checagem ativa da chave da Shopee (App ID + chave secreta). Quando a Shopee
  // passa a recusar, TODA oferta da loja é descartada e as ofertas automáticas
  // param — e, até este endpoint existir, o painel seguia mostrando a loja em
  // verde porque só conferia o formato dos campos (RCA ago/2026).
  //
  // Sem cache, de propósito: diferente do ML/Amazon, a sondagem é só leitura e
  // NÃO rotaciona credencial, então repetir não custa sessão. O que sobra é uma
  // chamada barata por abertura da tela.
  app.get('/shopee/session', { onRequest: [app.authenticate] }, async (req) => {
    const cred = await db.credential.findUnique({
      where: { userId_platform: { userId: req.user.sub, platform: 'shopee' } },
    })
    if (!cred) return { configured: false, alive: null, reason: 'not_configured' }
    const result = await checkShopeeSession(parseCredentialData(cred.data))
    app.log.debug({ userId: req.user.sub }, 'Shopee session: sondagem efetiva (chamada real à Shopee)')
    return { ...result, checkedAt: new Date().toISOString() }
  })

  app.put('/:platform', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { platform } = req.params
    if (!PLATFORMS.includes(platform)) return reply.code(400).send({ error: 'Plataforma inválida' })

    let sanitizedBody = sanitizeCredentialBody(platform, req.body)

    // T075: o painel manda a cliente colar o link do Gerador de Link da
    // SHEIN — um oneLink (`onelink.shein.com/...`) — mas `sanitizeCredentialBody`
    // é offline e não consegue extrair o número dele (o identificador só
    // aparece depois de resolver o link pela rede). Sem este passo, o cadastro
    // recusava exatamente o que a instrução mandava colar. A rota já faz
    // sondagem de rede para outras lojas (probeSavedCredential, abaixo) — é o
    // lugar certo para isto também; `validateCredentialData` continua pura.
    let sheinLinkResolutionFailed = false
    if (platform === 'shein') {
      const rawTag = String(sanitizedBody?.tag ?? '').trim()
      if (rawTag && !/^\d+$/.test(rawTag) && isSheinShortLink(rawTag)) {
        try {
          const resolved = await resolveSheinShortLink(rawTag)
          const extracted = extractSheinAffiliateId(resolved)
          if (extracted) {
            sanitizedBody = { ...sanitizedBody, tag: extracted }
          } else {
            // Resolveu (ou não) mas não achou o identificador — o formato
            // colado É um oneLink de verdade (isSheinShortLink já confirmou),
            // então isto nunca é "a cliente colou a coisa errada": é rede
            // lenta/fora do ar, captcha no meio do caminho, ou instabilidade
            // da SHEIN. Recusa seca aqui repetiria o próprio bug do T075 —
            // por isso vira aviso específico em vez do "Não reconhecemos esse
            // texto" genérico (ver mensagem abaixo).
            sheinLinkResolutionFailed = true
          }
        } catch (err) {
          app.log.warn({ err: err?.message }, 'Falha ao resolver link de afiliada da SHEIN no save')
          sheinLinkResolutionFailed = true
        }
      }
    }

    const validation = validateCredentialData(platform, sanitizedBody)
    if (validation.missing.length) {
      const error = sheinLinkResolutionFailed
        ? 'Não deu para conferir esse link agora (pode ser instabilidade da internet ou da SHEIN). ' +
          'Tente colar o link de novo em instantes, ou cole aqui apenas o seu número de afiliada — ele fica ' +
          'visível na mesma tela onde você gera o link.'
        : getCredentialSaveMessage(validation)
      return reply.code(400).send({
        error,
        validation,
      })
    }
    // Formato claramente errado (link colado no lugar do código, valor com
    // espaço, pedaço faltando) NÃO é salvo. Antes o save aceitava qualquer
    // texto e respondia "Tudo certo!" — uma conta ficou com um link guardado e
    // 537 recusas seguidas da loja, sem nada no painel que denunciasse.
    if (validation.invalid?.length) {
      return reply.code(400).send({
        error: validation.invalid[0].message,
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

    // Testa o código de acesso NA HORA DE SALVAR (RCA 2026-08-15, ver
    // src/credentialSaveCheck.js). Antes, o save só conferia se os campos
    // estavam preenchidos e respondia "Tudo certo!" mesmo para um código que a
    // loja recusa — um cliente novo salvou 17 vezes seguidas sem descobrir.
    //
    // Nunca bloqueia o save: a credencial JÁ foi gravada acima. Se a sondagem
    // falhar (loja fora do ar, timeout), o resultado vira "não deu para testar"
    // — nunca "não funciona".
    const sessionCheck = await probeSavedCredential({
      platform,
      userId: req.user.sub,
      data: parseCredentialData(cred.data),
      log: app.log,
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
    const saveFeedback = describeSaveSessionCheck({
      platform,
      validation,
      probe: sessionCheck,
      fallbackMessage: getCredentialSaveMessage(validation),
    })
    trackAnalyticsEventSafe({
      userId: req.user.sub,
      event: 'credential_saved',
      // `sessionAlive` responde, no histórico, quantas vezes alguém salvou um
      // código que a loja recusa — o sinal que faltava para enxergar o cliente
      // preso tentando de novo em vez de esperar ele reclamar no WhatsApp.
      metadata: { platform, status: validation.status, sessionAlive: sessionCheck?.alive ?? null, sessionReason: sessionCheck?.reason ?? null },
    })
    return {
      ...cred,
      data: parseCredentialData(cred.data),
      validation,
      message: saveFeedback.message,
      messageTone: saveFeedback.tone,
      sessionCheck,
      configReloaded,
      configReloadError,
      workerHealth,
      workerMetricsError,
      workerRestart,
      workerRestartError,
    }
  })

  // Sondagem pós-save. Espelha a persistência de rotação de cookie e o cache
  // das rotas GET /<loja>/session: sem persistir o patch, a rotação que a loja
  // devolve nesta chamada seria descartada e a sessão morreria mais cedo; sem
  // popular o cache, o painel dispararia uma SEGUNDA sondagem logo em seguida
  // (na Amazon isso custa mais uma rotação de cookie).
  async function probeSavedCredential({ platform, userId, data, log }) {
    if (!platformSupportsSessionCheck(platform)) return null
    const checkByPlatform = {
      mercadolivre: checkMercadoLivreSession,
      amazon: checkAmazonSession,
      shopee: checkShopeeSession,
    }
    try {
      const check = checkByPlatform[platform]
      if (typeof check !== 'function') return null
      const result = await check(data)
      const { credentialPatch, ...publicResult } = result || {}
      if (credentialPatch) {
        await db.credential.update({
          where: { userId_platform: { userId, platform } },
          data: { data: encryptCredential(JSON.stringify({ ...data, ...credentialPatch })) },
        })
      }
      const body = { ...publicResult, checkedAt: new Date().toISOString() }
      // Shopee não tem cache de sondagem (a chamada é só leitura, não gasta
      // sessão) — por isso fica de fora deste bloco.
      if (body.alive === true || body.alive === false) {
        if (platform === 'mercadolivre') setCachedMlProbe(userId, body)
        else if (platform === 'amazon') setCachedAmazonProbe(userId, body)
      }
      return body
    } catch (err) {
      // Falha da sondagem NUNCA vira "seu código não funciona": indeterminado.
      log?.warn?.({ platform, err: err?.message }, 'Falha ao testar o código de acesso após salvar')
      return { configured: true, alive: null, reason: 'check_failed', checkedAt: new Date().toISOString() }
    }
  }

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
        ? 'Pronto, apagamos. Os dados dessa loja não estão mais guardados aqui. Quando quiser voltar a usar, é só cadastrar de novo.'
        : 'Não havia nada guardado dessa loja por aqui.',
    }
  })
}
