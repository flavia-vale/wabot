/**
 * [PROTECTED_CORE]: Não modifique a lógica interna. Se precisar de novos comportamentos, use Decorators ou Extensões na camada externa.
 */
import { fork } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { safeCoreEvent } from './errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerPath = join(__dirname, '..', 'bot-worker.js')

const bots = new Map()
const pendingRequests = new Map()
const MAX_PENDING_REQUESTS = Math.max(10, Number(process.env.MANAGER_MAX_PENDING_REQUESTS || 500))
let healthTimer = null

function shouldAutoStartPersistedBots() {
  if (process.env.AUTO_START_WHATSAPP_SESSIONS === 'false') return false
  return !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0'
}

export async function resumePersistedBots(db, log = console) {
  if (!shouldAutoStartPersistedBots()) return { attempted: 0, started: 0, skipped: 0 }
  const sessions = await db.waSession.findMany({ where: { status: { in: ['connected', 'connecting'] } }, select: { userId: true } })
  let started = 0; let skipped = 0
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
    for (const [userId, entry] of bots.entries()) {
      if (!entry?.proc || entry.proc.killed) continue
      const hbAge = now - (entry.lastHeartbeatAt || 0)
      if (hbAge <= staleMs) continue
      log.warn?.({ userId, hbAge }, 'Worker com heartbeat estagnado — reiniciando sessão silenciosamente')
      stopBot(userId)
      setTimeout(() => startBot(userId), 1000).unref?.()
    }
    const persisted = await db.waSession.findMany({ where: { status: { in: ['connected', 'connecting'] } }, select: { userId: true } })
    for (const s of persisted) if (!bots.has(s.userId)) startBot(s.userId)
  }

  healthTimer = setInterval(() => tick().catch(err => log.error?.({ err: err.message }, 'Falha no monitor de saúde de sessão')), intervalMs)
  healthTimer.unref?.()
  return () => { if (healthTimer) clearInterval(healthTimer); healthTimer = null }
}

export function startBot(userId) {
  if (bots.has(userId)) return false
  const proc = fork(workerPath, [], { env: { ...process.env, BOT_USER_ID: userId } })
  const entry = { proc, qrListeners: new Set(), statusListeners: new Set(), lastQR: null, lastHeartbeatAt: Date.now() }
  bots.set(userId, entry)

  proc.on('message', msg => safeCoreEvent('worker_message', () => {
    if (!msg?.type) return
    if (msg.type === 'qr') { entry.lastQR = msg.data; entry.qrListeners.forEach(fn => fn(msg.data)) }
    if (msg.type === 'heartbeat') entry.lastHeartbeatAt = Date.now()
    if (msg.type === 'status') {
      if (msg.data === 'connected' || msg.data === 'disconnected') entry.lastQR = null
      entry.statusListeners.forEach(fn => fn(msg.data, msg.phone))
    }
    if (msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (!pending) return
      if (msg.error) pending.reject(new Error(msg.error)); else pending.resolve(msg.data ?? msg.code)
      pendingRequests.delete(msg.requestId)
    }
  }))
  proc.on('exit', () => bots.delete(userId))
  return true
}

export function stopBot(userId) {
  const entry = bots.get(userId)
  if (!entry) return false
  bots.delete(userId)
  try { entry.proc.send({ type: 'stop' }) } catch {}
  const forceKillMs = Math.max(Number(process.env.WA_FORCE_KILL_MS || 10000), 2000)
  setTimeout(() => { if (!entry.proc.killed) try { entry.proc.kill('SIGKILL') } catch {} }, forceKillMs).unref?.()
  return true
}

export const isRunning = userId => bots.has(userId)
export const listRunningBots = () => [...bots.keys()]
export function onQR(userId, fn) { const e = bots.get(userId); if (!e) return () => {}; if (e.lastQR) fn(e.lastQR); e.qrListeners.add(fn); return () => e.qrListeners.delete(fn) }
export function onStatus(userId, fn) { const e = bots.get(userId); if (!e) return () => {}; e.statusListeners.add(fn); return () => e.statusListeners.delete(fn) }
export const getLastQR = userId => bots.get(userId)?.lastQR ?? null

function requestWithTimeout(userId, type, payload = {}, timeout = 10000, timeoutMessage = 'Timeout') {
  return new Promise((resolve, reject) => {
    const entry = bots.get(userId)
    if (!entry) return reject(new Error('Bot não está rodando'))
    if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
      return reject(new Error('Sistema ocupado: muitas requisições pendentes, tente novamente em instantes'))
    }
    const requestId = Math.random().toString(36).slice(2)
    pendingRequests.set(requestId, { resolve, reject })
    setTimeout(() => { if (pendingRequests.has(requestId)) { pendingRequests.delete(requestId); reject(new Error(timeoutMessage)) } }, timeout)
    entry.proc.send({ type, requestId, ...payload })
  })
}

export const listGroups = userId => requestWithTimeout(userId, 'listGroups', {}, 10000, 'Timeout ao buscar grupos')
export const sendBroadcast = (userId, text, jids) => requestWithTimeout(userId, 'broadcast', { text, jids }, 30000, 'Timeout ao enviar mensagem')
export const getBotMetrics = userId => bots.has(userId) ? requestWithTimeout(userId, 'metrics', {}, 5000, 'Timeout ao buscar métricas') : Promise.resolve(null)
export const requestPairingCode = (userId, phone) => requestWithTimeout(userId, 'requestPairingCode', { phone }, 45000, 'Timeout ao solicitar código de pareamento')
export function reloadConfig(userId) { const e = bots.get(userId); if (!e) return false; try { e.proc.send({ type: 'reloadConfig' }) } catch {}; return true }

export const refreshWaGroups = userId =>
  requestWithTimeout(userId, 'refreshWaGroups', {}, 15000, 'Timeout ao atualizar grupos do WhatsApp')

export const channelMetadata = (userId, { jid, inviteCode }) =>
  requestWithTimeout(userId, 'channel:metadata', { jid, inviteCode }, 15000, 'Timeout ao buscar metadata do canal')

export const followChannelImmediate = (userId, jid) =>
  requestWithTimeout(userId, 'channel:follow', { jid }, 15000, 'Timeout ao seguir canal')

export const listFollowedChannels = (userId) =>
  requestWithTimeout(userId, 'channel:listFollowed', {}, 20000, 'Timeout ao listar canais seguidos')

export function stopAllBots() { const ids = listRunningBots(); for (const id of ids) stopBot(id); return ids.length }
