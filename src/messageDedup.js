// Teto de entradas guardadas em `msgIds`. Com a janela default (5min) o volume
// é naturalmente pequeno; o teto existe para que subir DEDUP_MSGID_WINDOW_MS
// num ambiente não faça o arquivo de dedup crescer sem limite. Mantemos as mais
// NOVAS: descartar uma entrada antiga só reabre a porta pra um replay muito
// velho, enquanto descartar a nova reabriria pro replay imediato (bem mais
// provável).
export const MAX_DEDUP_MSGID_ENTRIES = 20_000

// Teto do conjunto de ids VISTOS (RCA 2026-09-24, portão de entrada tardio).
// Diferente de msgIds (5min), ele guarda 2h de ids aceitos; numa conta pesada
// (~500 mensagens/h) são ~1.000 entradas × ~80 bytes ≈ 80 KB em disco e em
// memória — por robô. O teto só existe para um pico anômalo não crescer o
// arquivo sem limite; mantém as mais NOVAS (descartar a antiga só reabre a
// porta para um replay muito velho, que a janela tardia já descarta).
export const MAX_SEEN_INCOMING_IDS = 50_000

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

  // seenIds: janela própria (mais longa). Número simples de janela (legado)
  // não poda seenIds — quem chama com número não conhece o campo.
  const seenWindow = Math.max(0, Number(
    typeof windowMs === 'object' && windowMs !== null ? windowMs.seenIds : 0,
  ) || 0)
  const seenIds = store?.seenIds && typeof store.seenIds === 'object' ? store.seenIds : {}
  store.seenIds = seenIds
  if (seenWindow > 0) {
    for (const key of Object.keys(seenIds)) {
      const ts = Number(seenIds[key] ?? 0)
      if (!Number.isFinite(ts) || now - ts >= seenWindow) delete seenIds[key]
    }
    const keys = Object.keys(seenIds)
    if (keys.length > MAX_SEEN_INCOMING_IDS) {
      keys.sort((a, b) => Number(seenIds[a]) - Number(seenIds[b]))
      for (const key of keys.slice(0, keys.length - MAX_SEEN_INCOMING_IDS)) delete seenIds[key]
    }
  }

  return store
}

/** O id já foi visto (aceito) por este robô dentro da janela? */
export function hasSeenIncomingId(store, key, now = Date.now(), windowMs = 0) {
  if (!key || !store?.seenIds || typeof store.seenIds !== 'object') return false
  const ts = Number(store.seenIds[key] ?? 0)
  return Number.isFinite(ts) && ts > 0 && now - ts < windowMs
}

export function rememberSeenIncomingId(store, key, ts = Date.now()) {
  if (!key || !store) return false
  if (!store.seenIds || typeof store.seenIds !== 'object') store.seenIds = {}
  store.seenIds[key] = ts
  return true
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
