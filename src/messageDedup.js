export function pruneDedupStore(store, now = Date.now(), windowMs = 300_000) {
  const safeWindow = Math.max(0, Number(windowMs) || 0)
  const msgIds = Array.isArray(store?.msgIds) ? store.msgIds : []
  const links = store?.links && typeof store.links === 'object' ? store.links : {}

  store.msgIds = msgIds.filter(entry => {
    const ts = Number(entry?.ts ?? 0)
    return Number.isFinite(ts) && now - ts < safeWindow
  })

  store.links = links
  for (const key of Object.keys(store.links)) {
    const ts = Number(store.links[key] ?? 0)
    if (!Number.isFinite(ts) || now - ts >= safeWindow) delete store.links[key]
  }

  return store
}

export function buildIncomingDedupKey(msg) {
  const remoteJid = String(msg?.key?.remoteJid ?? '').trim()
  const id = String(msg?.key?.id ?? '').trim()
  if (!remoteJid || !id) return null
  return `${remoteJid}:${id}`
}

export function hasRecentDedupEntry(entries, key, now = Date.now(), windowMs = 300_000) {
  if (!key || !Array.isArray(entries)) return false
  return entries.some(entry => {
    const ts = Number(entry?.ts ?? 0)
    return entry?.id === key && Number.isFinite(ts) && now - ts < windowMs
  })
}

export function rememberDedupEntry(store, key, ts = Date.now()) {
  if (!key) return false
  if (!Array.isArray(store.msgIds)) store.msgIds = []
  store.msgIds.push({ id: key, ts })
  return true
}
