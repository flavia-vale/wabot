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

  const entry = { proc, qrListeners: new Set(), statusListeners: new Set() }
  bots.set(userId, entry)

  proc.on('message', msg => {
    if (!msg?.type) return
    if (msg.type === 'qr') entry.qrListeners.forEach(fn => fn(msg.data))
    if (msg.type === 'status') entry.statusListeners.forEach(fn => fn(msg.data, msg.phone))
    if (msg.type === 'groups' && msg.requestId) {
      const pending = pendingRequests.get(msg.requestId)
      if (pending) { pending.resolve(msg.data); pendingRequests.delete(msg.requestId) }
    }
  })

  proc.on('exit', () => bots.delete(userId))
  return true
}

export function stopBot(userId) {
  const entry = bots.get(userId)
  if (!entry) return false
  try { entry.proc.send({ type: 'stop' }) } catch {}
  return true
}

export function isRunning(userId) {
  return bots.has(userId)
}

export function onQR(userId, fn) {
  const entry = bots.get(userId)
  if (!entry) return () => {}
  entry.qrListeners.add(fn)
  return () => entry.qrListeners.delete(fn)
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

export function onStatus(userId, fn) {
  const entry = bots.get(userId)
  if (!entry) return () => {}
  entry.statusListeners.add(fn)
  return () => entry.statusListeners.delete(fn)
}
