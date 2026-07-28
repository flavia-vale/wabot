// Teto de entradas guardadas em `msgIds`. A janela de msgIds passou de 5min
// para 24h (RCA da mensagem espelhada 5x: a única barreira contra o WhatsApp
// reofertar a MESMA mensagem horas depois era a janela de link, que expira em
// 120min) — sem teto, uma conta movimentada acumularia dezenas de milhares de
// entradas no arquivo de dedup. Mantemos as mais NOVAS: uma entrada antiga
// descartada só reabre a porta pra um replay muito velho, enquanto descartar a
// nova reabriria pro replay imediato (bem mais provável).
export const MAX_DEDUP_MSGID_ENTRIES = 20_000

export function pruneDedupStore(store, now = Date.now(), windowMs = 300_000) {
  // Aceita número (mesma janela pra msgIds e links) OU objeto
  // { msgIds, links } pra janelas independentes — necessário porque o dedup
  // de URL→destino precisa de janela longa (fonte reposta a mesma oferta
  // depois de 5 min), enquanto msgIds só protege contra redelivery do WA.
  const msgIdWindow = Math.max(0, Number(
    typeof windowMs === 'object' && windowMs !== null ? windowMs.msgIds : windowMs,
  ) || 0)
  const linkWindow = Math.max(0, Number(
    typeof windowMs === 'object' && windowMs !== null ? windowMs.links : windowMs,
  ) || 0)
  const msgIds = Array.isArray(store?.msgIds) ? store.msgIds : []
  const links = store?.links && typeof store.links === 'object' ? store.links : {}

  const kept = msgIds.filter(entry => {
    const ts = Number(entry?.ts ?? 0)
    return Number.isFinite(ts) && now - ts < msgIdWindow
  })
  store.msgIds = kept.length > MAX_DEDUP_MSGID_ENTRIES
    ? kept.slice(kept.length - MAX_DEDUP_MSGID_ENTRIES)
    : kept

  store.links = links
  for (const key of Object.keys(store.links)) {
    const ts = Number(store.links[key] ?? 0)
    if (!Number.isFinite(ts) || now - ts >= linkWindow) delete store.links[key]
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
