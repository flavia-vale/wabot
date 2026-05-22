import { startBot, stopBot, isRunning, onQR, onStatus, listGroups, requestPairingCode, getBotMetrics, getLastQR } from '../../manager.js'
import db from '../../db.js'
import { rm } from 'fs/promises'
import { getAuthInfoDir } from '../../paths.js'
import { mapInfraError } from '../../errors.js'

const WA_GROUPS_RECOVERY_TIMEOUT_MS = Math.max(Number(process.env.WA_GROUPS_RECOVERY_TIMEOUT_MS || 15000), 0)
const WA_GROUPS_RECOVERY_RETRY_MS = Math.max(Number(process.env.WA_GROUPS_RECOVERY_RETRY_MS || 1000), 100)
const RESUMABLE_SESSION_STATUSES = new Set(['connected', 'connecting'])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

function normalizePairingPhone(rawPhone) {
  const digits = String(rawPhone ?? '').replace(/\D/g, '')
  if (!digits) return { ok: false, message: 'Número de telefone obrigatório' }

  let br = digits
  if (br.startsWith('55')) br = br.slice(2)

  if (br.length < 10 || br.length > 11) {
    return { ok: false, message: 'Número inválido. Use DDI+DDD+número (ex.: 5511999999999).' }
  }

  const ddd = br.slice(0, 2)
  const subscriber = br.slice(2)
  if (!/^\d{2}$/.test(ddd)) return { ok: false, message: 'DDD inválido.' }
  if (subscriber.length === 9 && !subscriber.startsWith('9')) {
    return { ok: false, message: 'Celular com 9 dígitos deve iniciar com 9.' }
  }

  return { ok: true, phone: `55${ddd}${subscriber}` }
}

function isPrismaShapeMismatch(err) {
  const message = String(err?.message ?? '')
  return message.includes('Unknown argument') || message.includes('Unknown field') || message.includes('no such column') || message.includes('does not exist in the current database')
}

async function findSessionStartUser(userId) {
  try {
    return await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true, status: true } })
  } catch (err) {
    if (!isPrismaShapeMismatch(err)) throw err
    return db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
  }
}

export async function sessionRoutes(app) {
  app.post('/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const user = await findSessionStartUser(userId)
    if (user.status === 'banned' || user.status === 'suspended') {
      return reply.code(403).send({ error: 'Conta bloqueada. Entre em contato com o suporte.' })
    }
    if (user.accessExpiresAt && user.accessExpiresAt < new Date()) {
      const msg = user.plan === 'trial'
        ? 'Seu trial expirou. Assine um plano em Planos.'
        : 'Sua assinatura expirou. Renove em Planos.'
      return reply.code(403).send({ error: msg })
    }

    const running = Boolean(await isRunning(userId))
    if (running) {
      // Em modo remote, a API pode ver o worker como "rodando" enquanto o
      // socket WhatsApp já caiu (sem heartbeat / status='disconnected' no DB).
      // Nesse caso o QR nunca chega na dashboard. Tratamos como órfão:
      // derruba o worker e refaz o start limpo.
      const session = await db.waSession.findUnique({ where: { userId }, select: { status: true } }).catch(() => null)
      const isOrphan = !session || session.status === 'disconnected'
      if (!isOrphan) return reply.code(409).send({ error: 'Bot já está rodando' })
      req.log.warn({ userId, dbStatus: session?.status }, 'Worker órfão detectado em /start — reiniciando sessão')
      try { await stopBot(userId) } catch (err) { req.log.warn({ err: err.message }, 'Falha ao parar worker órfão') }
      // Pequeno gap para o supervisor liberar o slot antes do start novo.
      await new Promise(r => setTimeout(r, 250))
    }

    await startBot(userId)
    return { ok: true, message: 'Bot iniciado — aguarde o QR' }
  })

  app.post('/stop', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const stopped = await stopBot(userId)
    if (!stopped) return reply.code(404).send({ error: 'Bot não estava rodando' })
    await db.waSession.updateMany({
      where: { userId },
      data: { status: 'disconnected' },
    }).catch(() => {})
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
    return {
      running,
      status: session?.status ?? 'disconnected',
      phone: session?.phone ?? null,
      metrics,
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
    if (!(await isRunning(userId))) return reply.code(400).send({ error: 'Bot não está rodando' })
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
      data: { status: 'disconnected', phone: null },
    }).catch(() => {})
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
      if (scheme !== 'BOTinho-auth' || !token) throw new Error('Token WS ausente')
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
