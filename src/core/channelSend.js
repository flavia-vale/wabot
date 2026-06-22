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

// Normaliza/valida o JID do canal do próprio usuário (botão "Ver canal").
// Aceita o formato `<digitos>@newsletter`. Retorna:
//   ''   → vazio (campo limpo, sem botão injetado)
//   jid  → JID válido
//   null → formato inválido (a rota deve responder 400)
export function normalizeChannelForwardJid(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return /^\d+@newsletter$/.test(raw) ? raw : null
}

// Reconstrói o proto de mídia usado em relayMessage (grupo→grupo) trocando o
// caption e HIGIENIZANDO o contextInfo de newsletter herdado da ORIGEM — é ele
// que renderiza o botão "Ver canal" apontando para o canal de outra pessoa.
//
// Cópia rasa de propósito: só toca em `caption` e em `contextInfo`. Os campos
// de mídia (mediaKey, url, fileSha256, mediaKeyTimestamp — alguns são Buffer ou
// Long do protobuf) ficam por referência, exatamente como o `{ ...proto }`
// histórico, para não corromper a mídia já hospedada no WhatsApp.
//
// `forwardNewsletter` (opcional, { newsletterJid, newsletterName,
// serverMessageId }): quando presente, injeta um forwardedNewsletterMessageInfo
// apontando para o canal do PRÓPRIO usuário. Usado pelo spike de validação
// (Fase 0) e, depois de validado, pela feature definitiva. Quando ausente, o
// proto sai apenas limpo (remove o botão de terceiros).
export function buildRelayProto(proto, { caption, forwardNewsletter = null } = {}) {
  if (proto == null) return proto
  const next = { ...proto }
  if (caption !== undefined) next.caption = caption

  const ctx = { ...(proto.contextInfo || {}) }
  delete ctx.forwardedNewsletterMessageInfo
  delete ctx.externalAdReply

  if (forwardNewsletter && forwardNewsletter.newsletterJid) {
    const info = {
      newsletterJid: String(forwardNewsletter.newsletterJid),
      newsletterName: String(forwardNewsletter.newsletterName ?? ''),
    }
    if (forwardNewsletter.serverMessageId != null) {
      info.serverMessageId = Number(forwardNewsletter.serverMessageId)
    }
    ctx.forwardedNewsletterMessageInfo = info
    ctx.isForwarded = true
  }

  if (Object.keys(ctx).length === 0) {
    delete next.contextInfo
  } else {
    next.contextInfo = ctx
  }
  return next
}

// Injeta o botão nativo "Ver canal" (forwardedNewsletterMessageInfo) num payload
// já pronto para sock.sendMessage — cobre os caminhos que NÃO passam por
// buildRelayProto: imagem montada (buildMonitoredMessagePayload) e
// broadcast/oferta automática com imagem. É o irmão de buildRelayProto para o
// caminho sendMessage (não-relay).
//
// MÍDIA-ONLY (decisão pós-regressão): o botão só é injetado em corpos de MÍDIA
// (image/video). Mensagens de TEXTO PURO recebem o payload INTACTO — o WhatsApp
// derruba/rejeita texto carregando forwardedNewsletterMessageInfo (espelhamento
// de texto parava de sair). O botão nativo "Ver canal" só é confiável quando
// acompanha mídia encaminhada, que é como o WhatsApp o renderiza.
//
// `payload` aceita dois formatos:
//   - { primary, fallbacks } (buildMonitoredMessagePayload) → injeta em cada
//     corpo de mídia (o fallback de texto fica intacto);
//   - corpo cru de sendMessage ({ text } / { image, caption }) → injeta só se
//     for mídia.
// `forwardNewsletter` ausente/sem newsletterJid → retorna o payload INTACTO
// (no-op). Cópia rasa: não muta o input.
//
// ATENÇÃO: não usar em destino canal (@newsletter) — lá o contextInfo é removido
// por stripChannelUnsafeFields. O chamador deve checar isChannelDestination antes.
export function injectChannelForwardIntoPayload(payload, forwardNewsletter) {
  if (payload == null) return payload
  if (!forwardNewsletter || !forwardNewsletter.newsletterJid) return payload

  const info = {
    newsletterJid: String(forwardNewsletter.newsletterJid),
    newsletterName: String(forwardNewsletter.newsletterName ?? ''),
  }
  if (forwardNewsletter.serverMessageId != null) {
    info.serverMessageId = Number(forwardNewsletter.serverMessageId)
  }

  // Só mídia leva o botão; texto puro sai sem contextInfo (evita drop no WhatsApp).
  const isMediaBody = (body) => body != null && typeof body === 'object' && (body.image != null || body.video != null)

  const withButton = (body) => {
    if (!isMediaBody(body)) return body
    const ctx = { ...(body.contextInfo || {}) }
    ctx.forwardedNewsletterMessageInfo = info
    ctx.isForwarded = true
    return { ...body, contextInfo: ctx }
  }

  if (payload.primary) {
    return {
      ...payload,
      primary: withButton(payload.primary),
      fallbacks: Array.isArray(payload.fallbacks) ? payload.fallbacks.map(withButton) : payload.fallbacks,
    }
  }
  return withButton(payload)
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
