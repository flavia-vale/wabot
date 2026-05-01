import { startBot, stopBot, isRunning, onQR, onStatus } from '../../manager.js'
import db from '../../db.js'

export async function sessionRoutes(app) {
  app.post('/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub
    if (isRunning(userId)) return reply.code(409).send({ error: 'Bot já está rodando' })

    const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, trialExpiresAt: true } })
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
    const session = await db.waSession.findUnique({ where: { userId } })
    return {
      running: isRunning(userId),
      status: session?.status ?? 'disconnected',
      phone: session?.phone ?? null,
    }
  })

  // WebSocket: emite QR em tempo real (token via query string porque browser não envia headers em WS)
  app.get('/qr', { websocket: true }, (socket, req) => {
    let userId
    try {
      const token = req.query.token
      const decoded = app.jwt.verify(token)
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
