import { fork } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerPath = join(__dirname, 'bot-worker.js')

// userId -> { proc, qrListeners: Set, statusListeners: Set }
const bots = new Map()
const pendingRequests = new Map() // requestId -> { resolve, reject }
let zombieMonitorTimer = null

function shouldAutoStartPersistedBots() {
  if (process.env.AUTO_START_WHATSAPP_SESSIONS === 'false') return false
  return !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0'
}

export async function resumePersistedBots(db, log = console) {
  if (!shouldAutoStartPersistedBots()) {
    log.info?.('Auto-start de sessões WhatsApp desabilitado para esta instância')
    return { attempted: 0, started: 0, skipped: 0 }
  }

  const sessions = await db.waSession.findMany({ where: { status: { in: ['connected', 'connecting'] } }, select: { userId: true } })

  let started = 0
  let skipped = 0
  for (const session of sessions) {
    if (bots.has(session.userId)) { skipped++; continue }
    if (startBot(session.userId)) started++
    else skipped++
  }

  log.info?.({ attempted: sessions.length, started, skipped }, 'Sessões WhatsApp persistidas retomadas')
  return { attempted: sessions.length, started, skipped }
}

export function startSessionHealthMonitor(db, log = console) {
  if (!shouldAutoStartPersistedBots()) return () => {}
  const intervalMs = Math.max(Number(process.env.WA_ZOMBIE_CHECK_INTERVAL_MS || 15000), 5000)
  const staleMs = Math.max(Number(process.env.WA_HEARTBEAT_STALE_MS || 90000), 30000)

  const tick = async () => {
    const now = Date.now()
    const sessions = await db.waSession.findMany({
      where: { status: { in: ['connected', 'connecting'] } },
      select: { userId: true, lastHeartbeatAt: true, ownerInstance: true, lifecycle: true },
    })
    for (const s of sessions) {
      const isRunning = bots.has(s.userId)
      const hbAge = s.lastHeartbeatAt ? (now - new Date(s.lastHeartbeatAt).getTime()) : Number.POSITIVE_INFINITY
      const stale = hbAge > staleMs
      if (!isRunning && stale) {
        log.warn?.({ userId: s.userId, hbAge, lifecycle: s.lifecycle }, 'Sessão zumbi detectada (sem processo local) — restart silencioso')
        startBot(s.userId)
        continue
      }
      if (isRunning && stale) {
        log.warn?.({ userId: s.userId, hbAge, lifecycle: s.lifecycle }, 'Heartbeat estagnado — reiniciando worker')
        stopBot(s.userId)
        setTimeout(() => startBot(s.userId), 1000)
      }
    }
  }

  zombieMonitorTimer = setInterval(() => {
    tick().catch(err => log.error?.({ err: err.message }, 'Falha no monitor de saúde das sessões'))
  }, intervalMs)
  zombieMonitorTimer.unref?.()
  return () => {
    if (zombieMonitorTimer) clearInterval(zombieMonitorTimer)
    zombieMonitorTimer = null
  }
}

export function stopAllBots() {
  const userIds = listRunningBots()
  for (const userId of userIds) stopBot(userId)
  return userIds.length
}

export function startBot(userId) { if (bots.has(userId)) return false
  const proc = fork(workerPath, [], { env: { ...process.env, BOT_USER_ID: userId } })
  const entry = { proc, qrListeners: new Set(), statusListeners: new Set(), lastQR: null }
  bots.set(userId, entry)
  proc.on('message', msg => {
    if (!msg?.type) return
    if (msg.type === 'qr') { entry.lastQR = msg.data; entry.qrListeners.forEach(fn => fn(msg.data)) }
    if (msg.type === 'status') { if (msg.data === 'connected' || msg.data === 'disconnected') entry.lastQR = null; entry.statusListeners.forEach(fn => fn(msg.data, msg.phone)) }
    if ((msg.type === 'groups' || msg.type === 'broadcastResult' || msg.type === 'pairingCode' || msg.type === 'metricsResult') && msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (!pending) return
      if (msg.error) pending.reject(new Error(msg.error))
      else pending.resolve(msg.data ?? msg.code)
      pendingRequests.delete(msg.requestId)
    }
  })
  proc.on('exit', () => bots.delete(userId))
  return true
}

export function stopBot(userId) {
  const entry = bots.get(userId)
  if (!entry) return false
  bots.delete(userId)
  try { entry.proc.send({ type: 'stop' }) } catch {}
  const forceKillMs = Math.max(Number(process.env.WA_FORCE_KILL_MS || 10000), 2000)
  setTimeout(() => {
    if (!entry.proc.killed) {
      try { entry.proc.kill('SIGKILL') } catch {}
    }
  }, forceKillMs).unref?.()
  return true
}

export const isRunning = userId => bots.has(userId)
export const listRunningBots = () => [...bots.keys()]
export function onQR(userId, fn) { const e = bots.get(userId); if (!e) return () => {}; if (e.lastQR) fn(e.lastQR); e.qrListeners.add(fn); return () => e.qrListeners.delete(fn) }
export function onStatus(userId, fn) { const e = bots.get(userId); if (!e) return () => {}; e.statusListeners.add(fn); return () => e.statusListeners.delete(fn) }

function requestWithTimeout(userId, type, payload, timeout, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const entry = bots.get(userId)
    if (!entry) return reject(new Error('Bot não está rodando'))
    const requestId = Math.random().toString(36).slice(2)
    pendingRequests.set(requestId, { resolve, reject })
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId)
        reject(new Error(timeoutMessage))
      }
    }, timeout)
    entry.proc.send({ type, requestId, ...payload })
  })
}

export const listGroups = userId => requestWithTimeout(userId, 'listGroups', {}, 10000, 'Timeout ao buscar grupos')
export const sendBroadcast = (userId, text, jids) => requestWithTimeout(userId, 'broadcast', { text, jids }, 30000, 'Timeout ao enviar mensagem')
export const getBotMetrics = userId => bots.has(userId) ? requestWithTimeout(userId, 'metrics', {}, 5000, 'Timeout ao buscar métricas') : Promise.resolve(null)
export const requestPairingCode = (userId, phone) => requestWithTimeout(userId, 'requestPairingCode', { phone }, 15000, 'Timeout ao solicitar código de pareamento')
export function reloadConfig(userId) { const e = bots.get(userId); if (!e) return false; try { e.proc.send({ type: 'reloadConfig' }) } catch {}; return true }
