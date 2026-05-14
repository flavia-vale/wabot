const EXTERNAL_AD_REPLY_KEY = 'externalAdReply'

function withConvertedUrlOnTop(finalText, primaryConvertedUrl) {
  const text = String(finalText || '').trim()
  const convertedUrl = String(primaryConvertedUrl || '').trim()
  if (!convertedUrl) return text
  return `${convertedUrl}\n\n${text}`.trim()
}

function assertNoExternalAdReply(value, path = 'payload') {
  if (!value || typeof value !== 'object') return
  if (Object.prototype.hasOwnProperty.call(value, EXTERNAL_AD_REPLY_KEY)) {
    throw new Error(`Payload monitorado inseguro: ${path}.${EXTERNAL_AD_REPLY_KEY} causa drop silencioso no WhatsApp`)
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') assertNoExternalAdReply(child, `${path}.${key}`)
  }
}

export function buildMonitoredMessagePayload({ finalText, primaryConvertedUrl, image }) {
  const textPayload = { text: String(finalText || ''), linkPreview: null }
  if (!image?.buffer || !primaryConvertedUrl) {
    return { _route: 'text', primary: textPayload, fallbacks: [] }
  }

  const imagePayload = {
    image: image.buffer,
    mimetype: 'image/jpeg',
    jpegThumbnail: image.jpegThumbnail,
    caption: withConvertedUrlOnTop(finalText, primaryConvertedUrl),
  }

  const payload = { _route: 'image', primary: imagePayload, fallbacks: [textPayload] }
  assertNoExternalAdReply(payload)
  return payload
}

export const __monitoredPayloadInternals = {
  assertNoExternalAdReply,
  withConvertedUrlOnTop,
}
