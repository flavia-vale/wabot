import crypto from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function numberEnv(name, fallback, min) {
  const parsed = Number(process.env[name])
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(min, parsed)
}

const DEFAULT_LOCK_ROOT = process.env.ML_AFFILIATE_LOCK_DIR || tmpdir()
const DEFAULT_LOCK_TIMEOUT_MS = numberEnv('ML_AFFILIATE_LOCK_TIMEOUT_MS', 12_000, 500)
const DEFAULT_LOCK_POLL_MS = numberEnv('ML_AFFILIATE_LOCK_POLL_MS', 150, 25)
const DEFAULT_LOCK_STALE_MS = numberEnv('ML_AFFILIATE_LOCK_STALE_MS', 30_000, 1_000)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))


function cookieValue(cookieHeader = '', name) {
  for (const part of String(cookieHeader || '').split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1)
  }
  return ''
}

export function mercadoLivreCredentialLockKey(creds = {}) {
  const sessionCookie = creds.ssid || cookieValue(creds.cookie, 'ssid') || creds.cookie || ''
  const parts = [
    String(creds.id || ''),
    String(sessionCookie),
  ]
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}

function buildLockPath(key, root) {
  return join(root, `wabot-ml-affiliate-${key}.lock`)
}

export async function withMercadoLivreCredentialLock(creds, work, options = {}) {
  const key = options.key || mercadoLivreCredentialLockKey(creds)
  const root = options.root || DEFAULT_LOCK_ROOT
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS
  const pollMs = options.pollMs ?? DEFAULT_LOCK_POLL_MS
  const staleMs = options.staleMs ?? DEFAULT_LOCK_STALE_MS
  const path = buildLockPath(key, root)
  const start = Date.now()
  let acquired = false

  while (!acquired) {
    try {
      await mkdir(path, { recursive: false })
      acquired = true
      break
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err
      try {
        const info = await stat(path)
        if (Date.now() - info.mtimeMs > staleMs) {
          await rm(path, { recursive: true, force: true })
          continue
        }
      } catch (statErr) {
        if (statErr?.code !== 'ENOENT') throw statErr
        continue
      }
      if (Date.now() - start >= timeoutMs) {
        const timeout = new Error('Mercado Livre createLink já está em uso por outro processo para esta credencial.')
        timeout.code = 'ML_AFFILIATE_LOCK_TIMEOUT'
        timeout.lockKey = key
        throw timeout
      }
      await sleep(pollMs)
    }
  }

  try {
    return await work()
  } finally {
    if (acquired) await rm(path, { recursive: true, force: true })
  }
}
