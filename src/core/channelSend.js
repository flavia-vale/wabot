import { detectKind, JID_KIND } from './jid.js'

// Verdadeiro quando o destino é canal (@newsletter).
// JIDs desconhecidos retornam false (defensivo).
export function isChannelDestination(destJid) {
  return detectKind(destJid) === JID_KIND.CHANNEL
}

// relayMessage reusa um proto de mídia já uploadado para o WhatsApp em
// outro chat. Funciona bem para grupo→grupo (mesma rede de upload), mas
// não para canal-destino — canal usa upload paths próprios. Para garantir
// entrega, pulamos o relay e enviamos via sendMessage com payload limpo
// quando o destino é canal.
//
// Default defensivo: JIDs desconhecidos não relay (sendMessage é mais
// seguro que relay com proto de origem incerta).
export function shouldUseRelayPath({ destJid, hasOriginal }) {
  if (!hasOriginal) return false
  if (detectKind(destJid) !== JID_KIND.GROUP) return false
  return true
}

// Remove campos que canais não suportam (quoted reply, contextInfo).
// Retorna um novo objeto sem mutar o input. null/undefined passa adiante.
//
// Lista atual reflete o que buildMonitoredMessagePayload emite hoje + sufixos
// historicamente quebrados em canal. Se Fase 4 enriquecer o payload (mentions,
// forward, viewOnce, ephemeralExpiration), revisitar esta lista.
export function stripChannelUnsafeFields(payload) {
  if (payload == null) return payload
  const { quoted, contextInfo, ...rest } = payload
  return rest
}

// Detecta se um erro de sendMessage indica que a conta NÃO pode postar
// no canal (não é admin/owner) — diferente de erro transitório de rede.
// Para erro "forbidden", o retry loop deve abortar imediatamente em vez
// de consumir SEND_MAX_ATTEMPTS, evitando rate-limit/ban por tentativas
// repetidas em destino permanentemente sem permissão.
//
// Heurísticas (Baileys 6.7.16 não expõe um código padronizado):
// - statusCode 403 em err.output (formato @hapi/boom usado por Baileys).
// - err.data === 403 (formato alternativo em alguns erros do Baileys).
// - Mensagens contendo "forbidden", "not authorized", "unauthorized",
//   "not admin" (case-insensitive).
export function isChannelForbiddenError(err) {
  if (err == null) return false
  const statusCode = err?.output?.statusCode ?? (typeof err?.data === 'number' ? err.data : null)
  if (statusCode === 403) return true
  const message = String(err?.message ?? '').toLowerCase()
  if (!message) return false
  return (
    message.includes('forbidden') ||
    message.includes('not authorized') ||
    message.includes('unauthorized') ||
    message.includes('not admin')
  )
}
