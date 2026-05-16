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
export function stripChannelUnsafeFields(payload) {
  if (payload == null) return payload
  const { quoted, contextInfo, ...rest } = payload
  return rest
}
