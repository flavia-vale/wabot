import { startBot, stopBot, isRunning, onQR, onStatus, listGroups, requestPairingCode, getBotMetrics, getLastQR, refreshWaGroups, listRunningBots } from '../../manager.js'
import db from '../../db.js'
import { rm } from 'fs/promises'
import { getAuthInfoDir } from '../../paths.js'
import { mapInfraError } from '../../errors.js'
import { appContainer } from '../../app/container.js'
import { classifyBotStartOutcome, normalizePairingPhone } from '../../domain/session/service.js'
import { classifyStartRefusal } from '../../domain/session/startRefusal.js'
import { recordWaConnectionEventSafe } from '../../waConnectionTelemetry.js'
import { MANUAL_STOP_EVENT } from '../../email/accountActivity.js'
import { resolveClientVisibleState, DEFAULT_CLIENT_GRACE_MS } from '../../core/clientVisibleSessionState.js'
import { anchorTrialOnFirstConnection } from '../../domain/painel/trialAnchorApply.js'
import { STANDARD_TRIAL_DAYS } from './auth.js'

// Subprotocolos aceitos no handshake do WebSocket do QR. São TOKENS do HTTP
// (RFC 6455 §4.1): não aceitam espaço. O nome vigente é 'espelhagrupos-auth';
// 'BOTinho-auth' continua aceito porque um navegador com bundle antigo em
// cache ainda o envia, e recusá-lo tiraria o QR em tempo real dessa pessoa
// sem que ela tenha feito nada. Precisa continuar batendo com
// QR_WS_SUBPROTOCOL em dashboard/lib/api.js.
const QR_WS_SUBPROTOCOLS = new Set(['espelhagrupos-auth', 'BOTinho-auth'])

const WA_GROUPS_RECOVERY_TIMEOUT_MS = Math.max(Number(process.env.WA_GROUPS_RECOVERY_TIMEOUT_MS || 15000), 0)
const WA_GROUPS_RECOVERY_RETRY_MS = Math.max(Number(process.env.WA_GROUPS_RECOVERY_RETRY_MS || 1000), 100)
const RESUMABLE_SESSION_STATUSES = new Set(['connected', 'connecting'])
// Carência antes de expor à cliente uma queda que o robô resolve sozinho.
// `0` volta a expor toda queda na hora (rollback sem redeploy).
const CLIENT_GRACE_MS = Math.max(0, Number(process.env.WA_CLIENT_GRACE_MS ?? DEFAULT_CLIENT_GRACE_MS))
const CLIENT_GRACE_CAP_MS = Math.max(30_000, Number(process.env.WA_HEARTBEAT_MAX_RECONNECTING_MS || 120_000))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Mesmos valores que o bot-supervisor lê — API e supervisor carregam o MESMO
// `.env` em cada ambiente, então a API consegue explicar a recusa sem mudar o
// contrato do supervisor (que, em modo `remote`, sequer é reiniciado no
// deploy). Ver domain/session/startRefusal.js.
const MAX_SESSIONS_PER_PROCESS = Math.max(1, Number(process.env.MAX_SESSIONS_PER_PROCESS || 20))
const SHARD_COUNT = Math.max(1, Math.floor(Number(process.env.SHARD_COUNT || 1)) || 1)
const SHARD_INDEX = Number(process.env.SHARD_INDEX ?? 0)

// Mede quantos robôs estão de fato ligados NA HORA da recusa. Best-effort: se
// a consulta falhar, devolve `null` e a classificação não afirma teto cheio.
async function describeStartRefusal(userId) {
  let runningCount = null
  try {
    const list = await listRunningBots()
    if (Array.isArray(list)) runningCount = list.length
  } catch {
    runningCount = null
  }
  return classifyStartRefusal({
    userId,
    shardCount: SHARD_COUNT,
    shardIndex: SHARD_INDEX,
    runningCount,
    maxSessions: MAX_SESSIONS_PER_PROCESS,
  })
}

function isRecoverableGroupLoadError(err) {
  const message = String(err?.message ?? err ?? '')
  return message.includes('Bot não está rodando') || message.includes('Bot não conectado') || message.includes('Timeout ao buscar grupos')
}

async function findResumableWaSession(userId) {
  const session = await db.waSession.findUnique({ where: { userId }, select: { status: true } })
  return RESUMABLE_SESSION_STATUSES.has(session?.status) ? session : null
}

export async function loadWaGroupsWithRecovery(userId, deps = {}) {
  const {
    isRunningFn = isRunning,
    startBotFn = startBot,
    listGroupsFn = listGroups,
    findResumableSessionFn = findResumableWaSession,
    timeoutMs = WA_GROUPS_RECOVERY_TIMEOUT_MS,
    retryMs = WA_GROUPS_RECOVERY_RETRY_MS,
    sleepFn = sleep,
  } = deps

  let recoveredProcess = false
  if (!(await isRunningFn(userId))) {
    const resumableSession = await findResumableSessionFn(userId)
    if (!resumableSession) throw new Error('Bot não está rodando')
    await startBotFn(userId)
    recoveredProcess = true
  }

  const startedAt = Date.now()
  let lastError = null

  do {
    try {
      const groups = await listGroupsFn(userId)
      return { groups, recoveredProcess }
    } catch (err) {
      lastError = err
      if (!isRecoverableGroupLoadError(err)) throw err
      if (Date.now() - startedAt >= timeoutMs) break
      await sleepFn(retryMs)
    }
  } while (Date.now() - startedAt < timeoutMs)

  const message = recoveredProcess
    ? 'Estamos retomando sua conexão com o WhatsApp. Aguarde alguns segundos e tente carregar os grupos novamente.'
    : lastError?.message || 'Falha ao buscar grupos do WhatsApp'
  const error = new Error(message)
  error.code = recoveredProcess ? 'WA_SESSION_RECOVERING' : 'WA_GROUPS_LOAD_FAILED'
  error.retryable = true
  throw error
}

const sessionService = appContainer.services.session

export async function sessionRoutes(app) {
  app.post('/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const user = await sessionService.findSessionStartUser(userId)
    const validation = sessionService.validateSessionStartUser(user)
    if (!validation.ok) return reply.code(validation.statusCode).send({ error: validation.error })

    const previousSession = await db.waSession.findUnique({ where: { userId }, select: { status: true, lifecycle: true } }).catch(() => null)
    const running = Boolean(await isRunning(userId))
    if (running) {
      // Em modo remote, a API pode ver o worker como "rodando" enquanto o
      // socket WhatsApp já caiu (sem heartbeat / status='disconnected' no DB).
      // Nesse caso o QR nunca chega na dashboard. Tratamos como órfão:
      // derruba o worker e refaz o start limpo.
      const isOrphan = !previousSession || previousSession.status === 'disconnected'
      if (!isOrphan) return reply.code(409).send({ error: 'Bot já está rodando' })
      req.log.warn({ userId, dbStatus: previousSession?.status }, 'Worker órfão detectado em /start — reiniciando sessão')
      try { await stopBot(userId) } catch (err) { req.log.warn({ err: err.message }, 'Falha ao parar worker órfão') }
      // Espera o worker antigo realmente sair antes do start novo. O slot só é
      // liberado no exit do processo (ver sessionCore.stopBot), então um gap fixo
      // poderia fazer o startBot abaixo virar no-op (bots.has ainda true) — ou,
      // no contrato antigo, abrir janela de dois workers no mesmo userId.
      const orphanFreeDeadline = Date.now() + Math.max(Number(process.env.WA_ORPHAN_STOP_WAIT_MS || 12000), 1000)
      while (Boolean(await isRunning(userId)) && Date.now() < orphanFreeDeadline) {
        await new Promise(r => setTimeout(r, 250))
      }
    }

    if (previousSession) {
      recordWaConnectionEventSafe({
        userId,
        type: 'manual_reconnect_requested',
        lifecycle: 'manual_start',
        metadata: { source: 'session_start', wasRunning: running, previousStatus: previousSession.status, previousLifecycle: previousSession.lifecycle },
      })
    }
    // O retorno do startBot NÃO pode ser descartado: em modo remote ele vem
    // `false` quando o supervisor RECUSA ligar (teto de sessões por processo
    // atingido, ou sessão fora do shard). Antes, a rota respondia "Bot iniciado"
    // e o QR simplesmente nunca chegava — a cliente ficava tentando sem chance
    // de sucesso e nada era registrado (RCA 2026-09-01).
    const startAccepted = await startBot(userId)
    if (startAccepted === false) {
      const stillRunning = Boolean(await isRunning(userId))
      const refusal = stillRunning ? null : await describeStartRefusal(userId)
      const outcome = classifyBotStartOutcome({ startAccepted, running: stillRunning, refusal })
      if (!outcome.ok) {
        // O motivo E os números medidos vão para o log: sem eles, separar
        // "teto cheio" de "conta no servidor errado" exigia entrar no VPS e ler
        // o log do supervisor (RCA 2026-09-07).
        req.log.error(
          { userId, code: outcome.code, reason: refusal?.reason, running: refusal?.running, max: refusal?.max },
          'Não foi possível ligar o robô em /start',
        )
        return reply.code(outcome.statusCode).send({ error: outcome.error, code: outcome.code, retryable: outcome.retryable })
      }
    }
    return { ok: true, message: 'Bot iniciado — aguarde o QR' }
  })

  app.post('/stop', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const stopped = await stopBot(userId)
    if (!stopped) return reply.code(404).send({ error: 'Bot não estava rodando' })
    // Grava o desligamento TAMBÉM na sessão, não só no evento. Sem isto o
    // `lifecycle` ficava congelado em 'ready' (confirmado em produção em
    // 2026-08-26: contas com último evento `manual_stop_requested` e
    // `lifecycle=ready`), então nem o painel da cliente nem a visão admin
    // conseguiam distinguir "ela desligou" de "caiu sozinho".
    await db.waSession.updateMany({
      where: { userId },
      data: { status: 'disconnected', lifecycle: 'stopped_by_user' },
    }).catch(() => {})
    // Marca que a desconexão foi PEDIDA. Sem isso, o aviso "seu robô está fora
    // do ar" sai para quem desligou de propósito (viagem, troca de chip).
    recordWaConnectionEventSafe({
      userId,
      type: MANUAL_STOP_EVENT,
      lifecycle: 'stopped_by_user',
      metadata: { source: 'painel' },
    })
    return { ok: true }
  })

  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const running = Boolean(await isRunning(userId))
    const includeMetrics = String(req.query?.metrics ?? '1') !== '0'
    const [session, metrics] = await Promise.all([
      db.waSession.findUnique({ where: { userId } }),
      includeMetrics && running ? getBotMetrics(userId).catch(() => null) : Promise.resolve(null),
    ])
    // A1 do plano de ativação de 2026-09-08: o teste passa a contar da PRIMEIRA
    // conexão, não do cadastro — quem leva quatro dias para conectar testava 3
    // dias, não 7. Dispare-e-esqueça de propósito: o status da sessão é a rota
    // mais quente do painel e não pode esperar (nem quebrar) por causa disso.
    // Desligado por padrão (TRIAL_ANCHOR_ON_CONNECT), e nesse caso nem toca no
    // banco — ver src/domain/painel/trialAnchor.js.
    if (session?.status === 'connected') {
      anchorTrialOnFirstConnection({
        db,
        userId,
        trialDays: STANDARD_TRIAL_DAYS,
        logger: req.log,
      }).catch(() => {})
    }

    return {
      running,
      status: session?.status ?? 'disconnected',
      // lifecycle carrega a nuance dentro de 'disconnected': 'reconnecting' =
      // o robô ainda está tentando reconectar sozinho (issue #1216, item #3).
      // Permite ao painel tranquilizar sem mascarar o status honesto.
      lifecycle: session?.lifecycle ?? null,
      phone: session?.phone ?? null,
      metrics,
      // Atalho de topo para o painel decidir o banner "reconecte" sem ter que
      // cavar dentro de metrics. Só presente quando métricas foram coletadas.
      sessionHealth: metrics?.sessionHealth ?? null,
      // Recepção funcional: 'ok'/'quiet' (nada a mostrar), 'blind' (conectado
      // e sem receber — o quadro do RCA 2026-08), 'starved' (suspeita fraca).
      // Só presente quando métricas foram coletadas.
      reception: metrics?.reception ?? null,
      // O que a CLIENTE deve ver. Queda que o robô resolve sozinho em poucos
      // minutos não vira aviso; o que exige ação dela nunca espera carência.
      // Ver src/core/clientVisibleSessionState.js.
      clientState: resolveClientVisibleState({
        running,
        status: session?.status ?? 'disconnected',
        lifecycle: session?.lifecycle ?? null,
        lastDisconnectCode: session?.lastDisconnectCode ?? null,
        disconnectedForMs: metrics?.disconnectedForMs ?? null,
        receptionState: metrics?.reception?.state ?? null,
        graceMs: CLIENT_GRACE_MS,
        maxReconnectingMs: CLIENT_GRACE_CAP_MS,
      }),
    }
  })

  // Força refresh manual do estado de grupos do WhatsApp. Atalho para o
  // workaround conhecido de "remover e re-adicionar grupo no painel" que
  // recupera grupos travados em Bad MAC (sender_key dessincronizada).
  // Ação leve (~1s); chama groupFetchAllParticipating() e segue a vida.
  app.post('/refresh-wa-state', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    if (!(await isRunning(userId))) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const result = await refreshWaGroups(userId)
      if (!result?.ok) {
        return reply.code(503).send({ error: result?.error || `Não foi possível atualizar agora: ${result?.reason || 'desconhecido'}` })
      }
      return result
    } catch (err) {
      req.log.warn({ err: err.message }, 'refresh-wa-state falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao atualizar grupos' })
    }
  })

  app.get('/wa-groups', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    try {
      const { groups } = await loadWaGroupsWithRecovery(userId)
      return groups
    } catch (err) {
      const statusCode = err.code === 'WA_SESSION_RECOVERING' ? 503 : 400
      return reply.code(statusCode).send({
        error: err.message,
        code: err.code,
        retryable: Boolean(err.retryable),
      })
    }
  })

  app.post('/pairing-code', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { phone } = req.body ?? {}
    const normalizedResult = normalizePairingPhone(phone)
    if (!normalizedResult.ok) return reply.code(400).send({ error: normalizedResult.message })
    const normalized = normalizedResult.phone
    // O worker recicla o socket + limpa AUTH_DIR atomicamente ao receber a IPC
    // 'requestPairingCode', então só precisamos garantir que o processo worker
    // esteja vivo pra receber a mensagem.
    if (!(await isRunning(userId))) {
      const startAccepted = await startBot(userId)
      // Pequena espera pro fork concluir e o handler IPC estar registrado.
      // requestWithTimeout no manager retorna 'Bot não está rodando' se chegar
      // antes do bots.set(userId, …); 600ms é folga sobre o tempo típico de fork.
      await new Promise(r => setTimeout(r, 600))
      // Se o robô não subiu, a falha é AQUI e tem motivo conhecido. Sem esta
      // checagem o pedido seguia adiante e estourava no manager com "Bot não
      // está rodando", que a tela mostra como "Bot não está conectado" — texto
      // cego que escondeu 183 recusas por capacidade (RCA 2026-09-01).
      const stillRunning = Boolean(await isRunning(userId))
      const refusal = startAccepted === false && !stillRunning ? await describeStartRefusal(userId) : null
      const outcome = classifyBotStartOutcome({ startAccepted, running: stillRunning, refusal })
      if (!outcome.ok) {
        req.log.error(
          { userId, phone: normalized, code: outcome.code, startAccepted, reason: refusal?.reason, running: refusal?.running, max: refusal?.max },
          'Não foi possível ligar o robô para o pareamento',
        )
        recordWaConnectionEventSafe({
          userId,
          type: 'manual_pairing_requested',
          lifecycle: 'pairing_requested',
          metadata: { source: 'pairing_code', workerWasRunning: false, refused: outcome.code, refusedReason: refusal?.reason ?? null },
        })
        return reply.code(outcome.statusCode).send({ error: outcome.error, code: outcome.code, retryable: outcome.retryable })
      }
    }
    recordWaConnectionEventSafe({
      userId,
      type: 'manual_pairing_requested',
      lifecycle: 'pairing_requested',
      metadata: { source: 'pairing_code', workerWasRunning: Boolean(await isRunning(userId)) },
    })
    try {
      const code = await requestPairingCode(userId, normalized)
      return { code }
    } catch (err) {
      const appErr = mapInfraError(err)
      req.log.error({ err, userId, phone: normalized, code: appErr.code }, 'Falha técnica ao solicitar pairing code')
      return reply.code(appErr.statusCode).send({
        code: appErr.code,
        message: appErr.message,
        retryable: appErr.retryable,
      })
    }
  })

  app.post('/forget', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    try { await stopBot(userId) } catch (err) { req.log.warn({ err: err.message, userId }, 'Falha ao parar worker em /forget') }
    await db.waSession.updateMany({
      where: { userId },
      data: { status: 'disconnected', lifecycle: 'stopped_by_user', phone: null },
    }).catch(() => {})
    recordWaConnectionEventSafe({
      userId,
      type: MANUAL_STOP_EVENT,
      lifecycle: 'stopped_by_user',
      metadata: { source: 'painel_esquecer' },
    })
    const authDir = getAuthInfoDir(userId)
    await rm(authDir, { recursive: true, force: true })
    return { ok: true }
  })


  app.post('/telemetry', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { stage = 'unknown', event = 'unknown', detail = null, elapsedSec = null } = req.body ?? {}
    req.log.info({ userId, stage, event, detail, elapsedSec }, 'Session telemetry')
    await db.adminAuditLog.create({
      data: {
        actorUserId: userId,
        targetUserId: userId,
        action: 'session.telemetry',
        resource: 'wa_session',
        resourceId: userId,
        after: JSON.stringify({ stage, event, detail, elapsedSec }),
        reason: 'dashboard_session_observability',
      },
    }).catch(() => {})
    return reply.code(202).send({ ok: true })
  })

  app.post('/qr-ticket', { onRequest: [app.authenticate] }, async (req) => {
    return {
      ticket: app.jwt.sign({ sub: req.user.sub, purpose: 'qr_ws' }, { expiresIn: '2m' }),
    }
  })

  app.get('/qr-latest', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    if (!(await isRunning(userId))) {
      return reply.code(400).send({ error: 'Bot não está rodando' })
    }
    const qr = await getLastQR(userId)
    return { qr: qr ?? null }
  })

  // WebSocket: emite QR em tempo real (ticket efêmero via subprotocol para não expor segredo na URL)
  app.get('/qr', { websocket: true }, async (socket, req) => {
    let userId
    try {
      const rawProtocols = req.headers['sec-websocket-protocol'] ?? ''
      const protocols = rawProtocols.split(',').map((value) => value.trim()).filter(Boolean)
      const [scheme, token] = protocols
      if (!QR_WS_SUBPROTOCOLS.has(scheme) || !token) throw new Error('Token WS ausente')
      const decoded = app.jwt.verify(token)
      if (decoded.purpose !== 'qr_ws') throw new Error('Ticket WS inválido')
      userId = decoded.sub
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Não autorizado' }))
      socket.close()
      return
    }

    if (!(await isRunning(userId))) {
      socket.send(JSON.stringify({ type: 'error', message: 'Bot não está rodando' }))
      socket.close()
      return
    }

    const unsubQR = onQR(userId, (qr) => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'qr', data: qr }))
    })

    const unsubStatus = onStatus(userId, (status, phone) => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'status', data: status, phone }))
      if (status === 'connected') socket.close()
    })

    socket.on('close', () => { unsubQR(); unsubStatus() })

    // Em modo remote, onQR só registra o listener — o QR cacheado fica no
    // supervisor. Enviamos o último QR conhecido imediatamente para que a
    // UI não precise esperar o próximo refresh (~20s).
    try {
      const last = await getLastQR(userId)
      if (last && socket.readyState === 1) {
        socket.send(JSON.stringify({ type: 'qr', data: last }))
      }
    } catch {}
  })
}
