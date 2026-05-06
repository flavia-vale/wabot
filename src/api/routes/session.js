import { startBot, stopBot, isRunning, onQR, onStatus, listGroups, requestPairingCode, getBotMetrics } from '../../manager.js'
import db from '../../db.js'
import { rm } from 'fs/promises'
import { resolve } from 'path'
import { mapInfraError } from '../../errors.js'

export async function sessionRoutes(app) {
  app.post('/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    if (isRunning(userId)) return reply.code(409).send({ error: 'Bot já está rodando' })

    const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, trialExpiresAt: true, status: true } })
    if (user.status === 'banned' || user.status === 'suspended') {
      return reply.code(403).send({ error: 'Conta bloqueada. Entre em contato com o suporte.' })
    }
    if (user.trialExpiresAt && user.trialExpiresAt < new Date()) {
      const msg = user.plan === 'trial'
        ? 'Seu trial expirou. Assine um plano em Planos.'
        : 'Sua assinatura expirou. Renove em Planos.'
      return reply.code(403).send({ error: msg })
    }

    startBot(userId)
    return { ok: true, message: 'Bot iniciado — aguarde o QR' }
  })

  app.post('/stop', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const stopped = stopBot(userId)
    if (!stopped) return reply.code(404).send({ error: 'Bot não estava rodando' })
    await db.waSession.updateMany({
      where: { userId },
      data: { status: 'disconnected' },
    }).catch(() => {})
    return { ok: true }
  })

  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub
    const running = isRunning(userId)
    const [session, metrics] = await Promise.all([
      db.waSession.findUnique({ where: { userId } }),
      running ? getBotMetrics(userId).catch(() => null) : Promise.resolve(null),
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
      const groups = await listGroups(userId)
      return groups
    } catch (err) {
      return reply.code(400).send({ error: err.message })
    }
  })

  app.post('/pairing-code', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    const { phone } = req.body ?? {}
    if (!phone) return reply.code(400).send({ error: 'Número de telefone obrigatório' })
    const normalized = phone.replace(/\D/g, '')
    if (normalized.length < 10) return reply.code(400).send({ error: 'Número inválido' })
    if (!isRunning(userId)) return reply.code(400).send({ error: 'Bot não está rodando' })
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
    stopBot(userId)
    await db.waSession.updateMany({
      where: { userId },
      data: { status: 'disconnected', phone: null },
    }).catch(() => {})
    const authDir = resolve(`./auth_info/${userId}`)
    await rm(authDir, { recursive: true, force: true })
    return { ok: true }
  })

  app.post('/qr-ticket', { onRequest: [app.authenticate] }, async (req) => {
    return {
      ticket: app.jwt.sign({ sub: req.user.sub, purpose: 'qr_ws' }, { expiresIn: '2m' }),
    }
  })

  // WebSocket: emite QR em tempo real (ticket efêmero via subprotocol para não expor segredo na URL)
  app.get('/qr', { websocket: true }, (socket, req) => {
    let userId
    try {
      const rawProtocols = req.headers['sec-websocket-protocol'] ?? ''
      const protocols = rawProtocols.split(',').map((value) => value.trim()).filter(Boolean)
      const [scheme, token] = protocols
      if (scheme !== 'wabot-auth' || !token) throw new Error('Token WS ausente')
      const decoded = app.jwt.verify(token)
      if (decoded.purpose !== 'qr_ws') throw new Error('Ticket WS inválido')
      userId = decoded.sub
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Não autorizado' }))
      socket.close()
      return
    }

    if (!isRunning(userId)) {
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
  })
}
