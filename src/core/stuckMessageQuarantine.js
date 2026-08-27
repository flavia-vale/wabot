import NodeCache from '@cacheable/node-cache'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export const STUCK_MESSAGE_QUARANTINE_VERSION = 1
export const DEFAULT_STUCK_MESSAGE_QUARANTINE_TTL_MS = 7 * 24 * 60 * 60_000

function retryKeyMessageId(key) {
  if (typeof key !== 'string') return ''
  const separator = key.indexOf(':')
  return separator === -1 ? key : key.slice(0, separator)
}

export function parseStuckMessageQuarantine(raw, now = Date.now(), ttlMs = DEFAULT_STUCK_MESSAGE_QUARANTINE_TTL_MS) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed?.version !== STUCK_MESSAGE_QUARANTINE_VERSION || !Array.isArray(parsed.messages)) return new Map()
    return new Map(parsed.messages
      .filter(item => typeof item?.msgId === 'string' && item.msgId && Number.isFinite(item.quarantinedAt))
      .filter(item => now - item.quarantinedAt <= ttlMs)
      .map(item => [item.msgId, item.quarantinedAt]))
  } catch {
    return new Map()
  }
}

export function createDurableStuckMessageRetryCache({ file, maxRetryCount = 5, now = () => Date.now(), ttlMs = DEFAULT_STUCK_MESSAGE_QUARANTINE_TTL_MS, logger } = {}) {
  const cache = new NodeCache({ stdTTL: Math.ceil(ttlMs / 1000), useClones: false })
  let quarantined = new Map()
  try {
    quarantined = parseStuckMessageQuarantine(readFileSync(file, 'utf8'), now(), ttlMs)
  } catch (err) {
    if (err?.code !== 'ENOENT') logger?.warn?.({ err: err.message }, 'Falha ao carregar quarentena de mensagens WA; seguindo com cache vazio')
  }

  function persist() {
    const currentNow = now()
    quarantined = new Map([...quarantined].filter(([, at]) => currentNow - at <= ttlMs))
    const payload = JSON.stringify({ version: STUCK_MESSAGE_QUARANTINE_VERSION, messages: [...quarantined].map(([msgId, quarantinedAt]) => ({ msgId, quarantinedAt })) })
    mkdirSync(dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    writeFileSync(temporary, payload, { mode: 0o600 })
    renameSync(temporary, file)
  }

  return {
    get(key) {
      const msgId = retryKeyMessageId(key)
      const quarantinedAt = quarantined.get(msgId)
      if (quarantinedAt && now() - quarantinedAt <= ttlMs) return maxRetryCount
      if (quarantinedAt) quarantined.delete(msgId)
      return cache.get(key)
    },
    set(key, value, ttl) {
      return ttl === undefined ? cache.set(key, value) : cache.set(key, value, ttl)
    },
    del(key) {
      if (quarantined.has(retryKeyMessageId(key))) return 0
      return cache.del(key)
    },
    quarantine(msgId) {
      if (typeof msgId !== 'string' || !msgId) return false
      const isNew = !quarantined.has(msgId)
      quarantined.set(msgId, now())
      try { persist() } catch (err) {
        logger?.error?.({ err: err.message, msgId }, 'Falha ao persistir quarentena de mensagem WA')
        return false
      }
      return isNew
    },
  }
}
