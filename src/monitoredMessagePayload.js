import { isRakutenTrackingUrl } from './integrations/rakuten/storeMatcher.js'

const EXTERNAL_AD_REPLY_KEY = 'externalAdReply'

// Mesma regra do Baileys para achar o link da prévia automática
// (Defaults/index.js URL_REGEX: o PRIMEIRO https:// do texto).
const BAILEYS_PREVIEW_URL_RE = /https:\/\/(?![^:@\/\s]+:[^:@\/\s]+@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?/

// Sem `linkPreview` no payload, o Baileys ABRE o primeiro link do texto a
// partir do servidor para montar a prévia (Utils/messages.js,
// generateLinkPreviewIfRequired) — mesmo com useLinkPreview=false. Num link
// da Rakuten isso é um clique contado vindo da VPS (clique falso,
// docs/rca/afiliados-rakuten.md). `linkPreview: null` desliga essa busca: a
// oferta sai como texto, sem card.
export function firstPreviewUrlCountsClick(text) {
  const url = String(text ?? '').match(BAILEYS_PREVIEW_URL_RE)?.[0]
  return Boolean(url && isRakutenTrackingUrl(url))
}

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
  } else if (firstPreviewUrlCountsClick(textPayload.text)) {
    textPayload.linkPreview = null
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
    // Baileys só calcula width/height sozinho quando NÃO recebe jpegThumbnail
    // pronto (Utils/messages.js: requiresThumbnailComputation). Como sempre
    // fornecemos o thumbnail pré-gerado (normalizeImageForWhatsApp), sem isso
    // o imageMessage sai sem dimensões e o WhatsApp renderiza a foto pequena.
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
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
