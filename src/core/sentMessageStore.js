// Guarda em DISCO as mensagens que o robô enviou, para atender o pedido de
// reenvio ("retry receipt") de quem recebeu e não conseguiu abrir.
//
// RCA 2026-09 (docs/rca/whatsapp-sessao.md, "Aguardando mensagem" nos membros
// do grupo de destino): o celular do membro que não consegue decifrar uma
// mensagem pede ao remetente que reenvie. O Baileys atende chamando
// `getMessage(key)` — e o default dele devolve `undefined`, então o pedido era
// descartado em silêncio ("recv retry request, but message not available", em
// debug) e o membro ficava preso em "Aguardando mensagem" para sempre.
//
// Disco em vez de memória (REGRA #1 de memória): cada mensagem é um arquivo
// com o protobuf codificado; RAM fica só com o contador. TTL + teto de
// arquivos por sessão limitam o disco. Fora do AUTH_DIR de propósito: o
// auth_info entra no backup diário (scripts/backup_prod.sh).
//
// Tudo é best effort: falha de disco nunca pode quebrar envio nem recepção.

import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

export const DEFAULT_SENT_MESSAGE_TTL_MS = 24 * 60 * 60_000
export const DEFAULT_SENT_MESSAGE_MAX_ENTRIES = 3000
export const DEFAULT_SENT_MESSAGE_PRUNE_EVERY_WRITES = 200

// O id vira nome de arquivo: só aceita o alfabeto dos ids do WhatsApp/Baileys
// (hex/alfanumérico). Qualquer outra coisa (/, .., vazio) é recusada.
export function toSafeMessageFileName(id) {
  if (typeof id !== 'string') return null
  const trimmed = id.trim()
  if (!trimmed || trimmed.length > 128 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) return null
  return `${trimmed}.bin`
}

export function createSentMessageStore({
  dir,
  encode,
  decode,
  ttlMs = DEFAULT_SENT_MESSAGE_TTL_MS,
  maxEntries = DEFAULT_SENT_MESSAGE_MAX_ENTRIES,
  pruneEveryWrites = DEFAULT_SENT_MESSAGE_PRUNE_EVERY_WRITES,
  now = () => Date.now(),
  logger,
} = {}) {
  let writesSincePrune = 0
  let dirReady = false

  function ensureDir() {
    if (dirReady) return
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    dirReady = true
  }

  function prune() {
    writesSincePrune = 0
    let names = []
    try {
      names = readdirSync(dir).filter(name => name.endsWith('.bin'))
    } catch (err) {
      if (err?.code !== 'ENOENT') logger?.warn?.({ err: err.message }, 'sent-message-store: falha ao listar para limpeza')
      return { removed: 0, kept: 0 }
    }
    const cutoff = now() - ttlMs
    const alive = []
    let removed = 0
    for (const name of names) {
      const path = join(dir, name)
      try {
        const { mtimeMs } = statSync(path)
        if (mtimeMs < cutoff) {
          unlinkSync(path)
          removed++
        } else {
          alive.push({ path, mtimeMs })
        }
      } catch {}
    }
    if (alive.length > maxEntries) {
      alive.sort((a, b) => a.mtimeMs - b.mtimeMs)
      for (const { path } of alive.splice(0, alive.length - maxEntries)) {
        try { unlinkSync(path); removed++ } catch {}
      }
    }
    return { removed, kept: alive.length }
  }

  function save(id, message) {
    const name = toSafeMessageFileName(id)
    if (!name || !message || typeof message !== 'object') return false
    try {
      ensureDir()
      const bytes = encode(message)
      const path = join(dir, name)
      const tmp = `${path}.tmp`
      writeFileSync(tmp, bytes, { mode: 0o600 })
      renameSync(tmp, path)
    } catch (err) {
      logger?.warn?.({ err: err.message, id }, 'sent-message-store: falha ao gravar mensagem enviada')
      return false
    }
    if (++writesSincePrune >= pruneEveryWrites) prune()
    return true
  }

  function load(id) {
    const name = toSafeMessageFileName(id)
    if (!name) return undefined
    const path = join(dir, name)
    try {
      const { mtimeMs } = statSync(path)
      if (mtimeMs < now() - ttlMs) return undefined
      return decode(readFileSync(path))
    } catch (err) {
      if (err?.code !== 'ENOENT') logger?.warn?.({ err: err.message, id }, 'sent-message-store: falha ao ler mensagem enviada')
      return undefined
    }
  }

  return { save, load, prune }
}
