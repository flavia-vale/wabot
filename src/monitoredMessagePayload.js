const EXTERNAL_AD_REPLY_KEY = 'externalAdReply'

// Lição de produção (incidente "Ver canal" + tentativa de preview 2026-06):
// contextInfo.externalAdReply em mensagem monitorada causa DROP SILENCIOSO no
// WhatsApp — o envio "sucede" no Baileys e ninguém recebe. A guarda roda em
// TODO payload retornado por buildMonitoredMessagePayload, inclusive na rota
// de texto (foi por essa brecha que a regressão passou da última vez).
function assertNoExternalAdReply(value, path = 'payload') {
  if (!value || typeof value !== 'object') return
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return
  if (Object.prototype.hasOwnProperty.call(value, EXTERNAL_AD_REPLY_KEY)) {
    throw new Error(`Payload monitorado inseguro: ${path}.${EXTERNAL_AD_REPLY_KEY} causa drop silencioso no WhatsApp`)
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') assertNoExternalAdReply(child, `${path}.${key}`)
  }
}

// `linkPreview` (formato WAUrlInfo do Baileys) permite injetar o card de URL
// manualmente quando o destino do link bloqueia o scraper automático (links
// de afiliado Shopee/Amazon). Para o card GRANDE, o chamador deve preencher
// linkPreview.highQualityThumbnail com o resultado de um upload prévio via
// prepareWAMessageMedia (thumbnail-link) — thumbnail inline gigante NÃO
// produz card grande e arrisca rejeição do proto.
export function buildMonitoredMessagePayload({ finalText, image, useLinkPreview = false, linkPreview = null }) {
  const textPayload = { text: String(finalText || '') }
  if (useLinkPreview && linkPreview && typeof linkPreview === 'object') {
    textPayload.linkPreview = linkPreview
  }
  const textSendOptions = useLinkPreview ? { generateHighQualityLinkPreview: true } : undefined

  if (!image?.buffer) {
    const payload = {
      _route: 'text',
      primary: textPayload,
      primarySendOptions: textSendOptions,
      fallbacks: [],
      fallbackSendOptions: [],
    }
    assertNoExternalAdReply(payload)
    return payload
  }

  const imagePayload = {
    image: image.buffer,
    mimetype: image.mimetype || 'image/jpeg',
    jpegThumbnail: image.jpegThumbnail,
    caption: String(finalText || ''),
  }

  const payload = {
    _route: 'image',
    primary: imagePayload,
    primarySendOptions: undefined,
    fallbacks: [textPayload],
    fallbackSendOptions: [textSendOptions],
  }
  assertNoExternalAdReply(payload)
  return payload
}

export const __monitoredPayloadInternals = {
  assertNoExternalAdReply,
}
