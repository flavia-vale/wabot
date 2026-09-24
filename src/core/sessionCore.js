/**
 * [PROTECTED_CORE]: Não modifique a lógica interna. Se precisar de novos comportamentos, use Decorators ou Extensões na camada externa.
 */
import { fork } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { safeCoreEvent } from './errors.js'
import { resolveWorkerExecArgv, resolveWorkerSpawnEnv } from './workerSpawnOptions.js'
import { shouldResurrectSession, buildResurrectionWhere, resolveIncludeReconnecting } from './sessionResurrectionPolicy.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerPath = join(__dirname, '..', 'bot-worker.js')

const bots = new Map()
const pendingRequests = new Map()
const commandBlocks = new Set()
const MAX_PENDING_REQUESTS = Math.max(10, Number(process.env.MANAGER_MAX_PENDING_REQUESTS || 500))
let healthTimer = null

function shouldAutoStartPersistedBots() {
  if (process.env.AUTO_START_WHATSAPP_SESSIONS === 'false') return false
  return !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0'
}

export async function resumePersistedBots(db, log = console) {
  if (!shouldAutoStartPersistedBots()) return { attempted: 0, started: 0, skipped: 0 }
  const sessions = (await db.waSession.findMany({
    where: buildResurrectionWhere({ includeReconnecting: resolveIncludeReconnecting() }),
    select: { userId: true, status: true, lifecycle: true },
  })).filter(row => shouldResurrectSession({ ...row, includeReconnecting: resolveIncludeReconnecting() }))
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
      if (entry.stopping) continue
      log.warn?.({ userId, hbAge }, 'Worker com heartbeat estagnado — reiniciando sessão silenciosamente')
      // Apenas dispara o teardown. O re-fork NÃO é agendado aqui: o slot do
      // `bots` só é liberado quando o processo antigo realmente sai (proc.on
      // 'exit'), e o resume de persistidas abaixo o recria num tick futuro
      // já com o slot livre. Isso evita dois workers vivos para o mesmo userId
      // (sobreposição de sockets Baileys → conflito 'replaced'/440 → flapping;
      // incidente 2026-06: api inline forkou 3 workers para a mesma sessão).
      stopBot(userId)
    }
    const persisted = (await db.waSession.findMany({
    where: buildResurrectionWhere({ includeReconnecting: resolveIncludeReconnecting() }),
    select: { userId: true, status: true, lifecycle: true },
  })).filter(row => shouldResurrectSession({ ...row, includeReconnecting: resolveIncludeReconnecting() }))
    for (const s of persisted) if (!bots.has(s.userId)) startBot(s.userId)
  }

  healthTimer = setInterval(() => tick().catch(err => log.error?.({ err: err.message }, 'Falha no monitor de saúde de sessão')), intervalMs)
  healthTimer.unref?.()
  return () => { if (healthTimer) clearInterval(healthTimer); healthTimer = null }
}

export function startBot(userId) {
  if (bots.has(userId)) return false
  // execArgv: aplica teto de heap por worker (--max-old-space-size) via
  // BOT_WORKER_MAX_OLD_SPACE_MB. Workers forkados não são alcançados pelo
  // max_memory_restart do PM2; sem isso um worker incha e, num VPS sem folga,
  // a pausa de GC derruba o socket WhatsApp (ver workerSpawnOptions.js).
  const proc = fork(workerPath, [], {
    env: { ...process.env, BOT_USER_ID: userId, ...resolveWorkerSpawnEnv(process.env) },
    execArgv: resolveWorkerExecArgv(process.env),
  })
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
  // Só libera o slot quando ESTE processo sai (e se ainda for a entry corrente).
  // Manter o slot ocupado durante o teardown garante que startBot/resume não
  // forkem um substituto enquanto o worker antigo ainda vive — invariante de
  // "um worker vivo por userId".
  proc.on('exit', () => { if (bots.get(userId) === entry) bots.delete(userId) })
  return true
}

export function stopBot(userId) {
  const entry = bots.get(userId)
  if (!entry) return false
  if (entry.stopping) return true
  // NÃO remove do mapa aqui: o slot só é liberado no proc.on('exit'). Isso
  // mantém isRunning(userId) verdadeiro enquanto o worker drena e sai, impedindo
  // que outro worker para o mesmo userId seja forkado durante a janela de
  // shutdown (worker antigo + novo = dois sockets na mesma credencial → 440).
  entry.stopping = true
  try { entry.proc.send({ type: 'stop' }) } catch {}
  const forceKillMs = Math.max(Number(process.env.WA_FORCE_KILL_MS || 10000), 2000)
  setTimeout(() => { if (!entry.proc.killed) try { entry.proc.kill('SIGKILL') } catch {} }, forceKillMs).unref?.()
  return true
}

export const isRunning = userId => bots.has(userId)
export const listRunningBots = () => [...bots.keys()]
// Read-only accessor para o supervisor monitorar zumbis sem precisar mexer
// na lógica interna do core. Retorna [{ userId, lastHeartbeatAt, killed }].
export const listSessionHealth = () => {
  const out = []
  for (const [userId, entry] of bots.entries()) {
    out.push({
      userId,
      lastHeartbeatAt: entry?.lastHeartbeatAt || 0,
      killed: Boolean(entry?.proc?.killed),
    })
  }
  return out
}
export function onQR(userId, fn) { const e = bots.get(userId); if (!e) return () => {}; if (e.lastQR) fn(e.lastQR); e.qrListeners.add(fn); return () => e.qrListeners.delete(fn) }
export function onStatus(userId, fn) { const e = bots.get(userId); if (!e) return () => {}; e.statusListeners.add(fn); return () => e.statusListeners.delete(fn) }
export const getLastQR = userId => bots.get(userId)?.lastQR ?? null

function requestWithTimeout(userId, type, payload = {}, timeout = 10000, timeoutMessage = 'Timeout') {
  return new Promise((resolve, reject) => {
    if (commandBlocks.has(userId)) return reject(new Error('Sessão temporariamente bloqueada para transferência de ownership'))
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
export const sendBroadcast = (userId, text, jids, options = {}) => requestWithTimeout(userId, 'broadcast', { text, jids, options }, 30000, 'Timeout ao enviar mensagem')
// Admin > Contato com cliente: manda para o PRÓPRIO número da conta (self-chat),
// nunca para grupo/canal. Sem MessageLog, sem dedup/preservação — é fora do
// pipeline de oferta, ver `sendSelfMessage` em src/bot-worker.js.
export const sendSelfMessage = (userId, text, actorUserId = null) => requestWithTimeout(userId, 'sendSelfMessage', { text, actorUserId }, 15000, 'Timeout ao enviar mensagem para o próprio número')
export const getBotMetrics = userId => bots.has(userId) ? requestWithTimeout(userId, 'metrics', {}, 5000, 'Timeout ao buscar métricas') : Promise.resolve(null)
export const blockSessionCommands = userId => { commandBlocks.add(userId); return true }
export const unblockSessionCommands = userId => commandBlocks.delete(userId)
export const getSessionProcessInfo = userId => {
  const entry = bots.get(userId)
  return entry ? { pid: entry.proc?.pid ?? null, killed: Boolean(entry.proc?.killed), lastHeartbeatAt: entry.lastHeartbeatAt || 0, stopping: Boolean(entry.stopping) } : null
}
export async function waitForBotExit(userId, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!bots.has(userId)) return true
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  return !bots.has(userId)
}
export async function waitForBotHeartbeat(userId, timeoutMs = 45_000, after = Date.now() - 1) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const entry = bots.get(userId)
    if (entry && !entry.proc?.killed && entry.lastHeartbeatAt > after) return true
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return false
}
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
