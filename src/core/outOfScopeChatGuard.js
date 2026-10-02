// Blindagem da sessão contra chats que o robô NÃO usa (RCA 2026-10-02, contas
// gabrielpontes@consultorfin.com e glauciasimoes10@gmail.com — ver
// docs/rca/whatsapp-sessao.md, "Cegueira com DMs fromMe de outro aparelho").
//
// O robô só espelha as fontes escolhidas e só posta nos destinos escolhidos,
// mas o socket processa TODO o tráfego do número. Cada incidente descobria um
// balde novo de tráfego inútil que derrubava a sessão (grupo, canal, DM de
// terceiros, DM de outro aparelho da conta). Duas regras fecham isso:
//
//  A. DM de outro aparelho da conta para um contato (from = a própria conta,
//     recipient = o contato) fora da lista de escolhidos → o socket confirma
//     com <ack> e descarta ANTES de abrir (gancho `shouldIgnoreOwnDeviceDm`
//     no patch do Baileys). Preventiva.
//  B. Quarentena por CHAT: o `stream:error` 500 cita o id da mensagem que o
//     servidor não aceitou; o patch avisa de qual chat cada id veio. Chat fora
//     da lista que derrubar a sessão N vezes na janela é ignorado por um TTL.
//     Reativa — é a rede para o balde que ainda não conhecemos.
//
// Tudo falha para o lado de DEIXAR PASSAR: regra desligada, lista ainda não
// carregada, jid vazio. Nunca entram aqui: o que está na lista (fontes,
// destinos, canal do botão), a própria conta e `status@broadcast`.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { normalizeJid } from './ignoredJidPolicy.js'

export const CHAT_DROP_QUARANTINE_VERSION = 1
export const DEFAULT_CHAT_DROP_QUARANTINE_TTL_MS = 7 * 24 * 60 * 60_000
export const DEFAULT_CHAT_DROP_WINDOW_MS = 24 * 60 * 60_000
export const DEFAULT_CHAT_DROP_THRESHOLD = 2
const STATUS_BROADCAST = 'status@broadcast'

// Regra A. `recipient` já vem filtrado pelo patch (DM de contato, nunca a
// própria conta). Aqui só a decisão de escopo.
export function shouldIgnoreOwnDeviceDm(recipient, { enabled = false, ready = false, allowedJids } = {}) {
  if (!enabled || !ready) return false
  const normalized = normalizeJid(recipient)
  if (!normalized) return false
  if (allowedJids && allowedJids.has(normalized)) return false
  return true
}

// Chat que pode entrar na quarentena da regra B.
export function isChatQuarantinable(chatJid, { allowedJids, selfJids } = {}) {
  const normalized = normalizeJid(chatJid)
  if (!normalized || normalized === STATUS_BROADCAST) return false
  if (allowedJids && allowedJids.has(normalized)) return false
  if (selfJids && selfJids.has(normalized)) return false
  return true
}

// Índice id da mensagem → chat, limitado (os ids mais antigos saem primeiro).
export function createRecentInboundIndex({ max = 5000 } = {}) {
  const byId = new Map()
  return {
    record(id, chatJid) {
      if (typeof id !== 'string' || !id || typeof chatJid !== 'string' || !chatJid) return
      byId.delete(id)
      byId.set(id, chatJid)
      while (byId.size > max) byId.delete(byId.keys().next().value)
    },
    get(id) {
      return byId.get(id)
    },
    get size() {
      return byId.size
    },
  }
}

export function parseChatDropQuarantine(raw, now = Date.now(), ttlMs = DEFAULT_CHAT_DROP_QUARANTINE_TTL_MS) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed?.version !== CHAT_DROP_QUARANTINE_VERSION || !Array.isArray(parsed.chats)) return new Map()
    return new Map(parsed.chats
      .filter(item => typeof item?.chatJid === 'string' && item.chatJid && Number.isFinite(item.quarantinedAt))
      .filter(item => now - item.quarantinedAt <= ttlMs)
      .map(item => [item.chatJid, item.quarantinedAt]))
  } catch {
    return new Map()
  }
}

// Regra B. Persistida no AUTH_DIR da conta (sobrevive a restart do worker e
// some junto com o auth em logout/reset, como a quarentena por mensagem).
export function createChatDropQuarantine({
  file,
  ttlMs = DEFAULT_CHAT_DROP_QUARANTINE_TTL_MS,
  windowMs = DEFAULT_CHAT_DROP_WINDOW_MS,
  threshold = DEFAULT_CHAT_DROP_THRESHOLD,
  now = () => Date.now(),
  logger,
} = {}) {
  let quarantined = new Map()
  const drops = new Map()
  if (file) {
    try {
      quarantined = parseChatDropQuarantine(readFileSync(file, 'utf8'), now(), ttlMs)
    } catch (err) {
      if (err?.code !== 'ENOENT') logger?.warn?.({ err: err.message }, 'Falha ao carregar quarentena de chats WA; seguindo vazia')
    }
  }

  function persist() {
    if (!file) return
    const currentNow = now()
    quarantined = new Map([...quarantined].filter(([, at]) => currentNow - at <= ttlMs))
    const payload = JSON.stringify({
      version: CHAT_DROP_QUARANTINE_VERSION,
      chats: [...quarantined].map(([chatJid, quarantinedAt]) => ({ chatJid, quarantinedAt })),
    })
    mkdirSync(dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    writeFileSync(temporary, payload, { mode: 0o600 })
    renameSync(temporary, file)
  }

  return {
    isQuarantined(chatJid) {
      const normalized = normalizeJid(chatJid)
      if (!normalized) return false
      const at = quarantined.get(normalized)
      if (!at) return false
      if (now() - at > ttlMs) {
        quarantined.delete(normalized)
        return false
      }
      return true
    },
    // Uma queda atribuída a este chat. Devolve se ele entrou (agora) na quarentena.
    registerDrop(chatJid) {
      const normalized = normalizeJid(chatJid)
      if (!normalized) return { count: 0, quarantined: false, newlyQuarantined: false }
      const currentNow = now()
      const recent = (drops.get(normalized) || []).filter(at => currentNow - at <= windowMs)
      recent.push(currentNow)
      drops.set(normalized, recent)
      if (recent.length < threshold) return { count: recent.length, quarantined: false, newlyQuarantined: false }
      const newlyQuarantined = !quarantined.has(normalized)
      quarantined.set(normalized, currentNow)
      try { persist() } catch (err) {
        logger?.error?.({ err: err.message, chatJid: normalized }, 'Falha ao persistir quarentena de chat WA')
      }
      return { count: recent.length, quarantined: true, newlyQuarantined }
    },
    get size() {
      return quarantined.size
    },
  }
}
