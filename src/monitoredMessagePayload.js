const EXTERNAL_AD_REPLY_KEY = 'externalAdReply'

function assertNoExternalAdReply(value, path = 'payload') {
  if (!value || typeof value !== 'object') return
  if (Object.prototype.hasOwnProperty.call(value, EXTERNAL_AD_REPLY_KEY)) {
    throw new Error(`Payload monitorado inseguro: ${path}.${EXTERNAL_AD_REPLY_KEY} causa drop silencioso no WhatsApp`)
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object') assertNoExternalAdReply(child, `${path}.${key}`)
  }
}

export function buildMonitoredMessagePayload({ finalText, image, useLinkPreview = false }) {
  const textPayload = { text: String(finalText || '') }
  const textSendOptions = useLinkPreview ? { generateHighQualityLinkPreview: true } : undefined

  if (!image?.buffer) {
    return {
      _route: 'text',
      primary: textPayload,
      primarySendOptions: textSendOptions,
      fallbacks: [],
      fallbackSendOptions: [],
    }
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
