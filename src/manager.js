import { fork } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerPath = join(__dirname, 'bot-worker.js')

// userId -> { proc, qrListeners: Set, statusListeners: Set }
const bots = new Map()
const pendingRequests = new Map() // requestId -> { resolve, reject }

export function startBot(userId) {
  if (bots.has(userId)) return false

  const proc = fork(workerPath, [], {
    env: { ...process.env, BOT_USER_ID: userId },
  })

  const entry = { proc, qrListeners: new Set(), statusListeners: new Set(), lastQR: null }
  bots.set(userId, entry)

  proc.on('message', msg => {
    if (!msg?.type) return
    if (msg.type === 'qr') {
      entry.lastQR = msg.data
      entry.qrListeners.forEach(fn => fn(msg.data))
    }
    if (msg.type === 'status') {
      if (msg.data === 'connected' || msg.data === 'disconnected') entry.lastQR = null
      entry.statusListeners.forEach(fn => fn(msg.data, msg.phone))
    }
    if (msg.type === 'groups' && msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (pending) {
        if (msg.error) pending.reject(new Error(msg.error))
        else pending.resolve(msg.data)
        pendingRequests.delete(msg.requestId)
      }
    }
    if (msg.type === 'broadcastResult' && msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (pending) {
        if (msg.error) pending.reject(new Error(msg.error))
        else pending.resolve(msg.data)
        pendingRequests.delete(msg.requestId)
      }
    }
    if (msg.type === 'pairingCode' && msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (pending) {
        if (msg.error) pending.reject(new Error(msg.error))
        else pending.resolve(msg.code)
        pendingRequests.delete(msg.requestId)
      }
    }
    if (msg.type === 'metricsResult' && msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (pending) {
        if (msg.error) pending.reject(new Error(msg.error))
        else pending.resolve(msg.data)
        pendingRequests.delete(msg.requestId)
      }
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
  return true
}

export function isRunning(userId) {
  return bots.has(userId)
}

export function onQR(userId, fn) {
  const entry = bots.get(userId)
  if (!entry) return () => {}
  if (entry.lastQR) fn(entry.lastQR)
  entry.qrListeners.add(fn)
  return () => entry.qrListeners.delete(fn)
}

export function onStatus(userId, fn) {
  const entry = bots.get(userId)
  if (!entry) return () => {}
  entry.statusListeners.add(fn)
  return () => entry.statusListeners.delete(fn)
}

export function listGroups(userId) {
  return new Promise((resolve, reject) => {
    const entry = bots.get(userId)
    if (!entry) return reject(new Error('Bot não está rodando'))
    const requestId = Math.random().toString(36).slice(2)
    pendingRequests.set(requestId, { resolve, reject })
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId)
        reject(new Error('Timeout ao buscar grupos'))
      }
    }, 10000)
    entry.proc.send({ type: 'listGroups', requestId })
  })
}

export function sendBroadcast(userId, text, jids) {
  return new Promise((resolve, reject) => {
    const entry = bots.get(userId)
    if (!entry) return reject(new Error('Bot não está rodando'))
    const requestId = Math.random().toString(36).slice(2)
    pendingRequests.set(requestId, { resolve, reject })
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId)
        reject(new Error('Timeout ao enviar mensagem'))
      }
    }, 30000)
    entry.proc.send({ type: 'broadcast', requestId, text, jids })
  })
}


export function getBotMetrics(userId) {
  return new Promise((resolve, reject) => {
    const entry = bots.get(userId)
    if (!entry) return resolve(null)
    const requestId = Math.random().toString(36).slice(2)
    pendingRequests.set(requestId, { resolve, reject })
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId)
        reject(new Error('Timeout ao buscar métricas'))
      }
    }, 5000)
    entry.proc.send({ type: 'metrics', requestId })
  })
}

export function requestPairingCode(userId, phone) {
  return new Promise((resolve, reject) => {
    const entry = bots.get(userId)
    if (!entry) return reject(new Error('Bot não está rodando'))
    const requestId = Math.random().toString(36).slice(2)
    pendingRequests.set(requestId, { resolve, reject })
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId)
        reject(new Error('Timeout ao solicitar código de pareamento'))
      }
    }, 15000)
    entry.proc.send({ type: 'requestPairingCode', requestId, phone })
  })
}

export function reloadConfig(userId) {
  const entry = bots.get(userId)
  if (!entry) return false
  try { entry.proc.send({ type: 'reloadConfig' }) } catch {}
  return true
}
