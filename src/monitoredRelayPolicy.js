// Decide quando o pipeline monitorado pode usar relayMessage para reaproveitar
// a mídia hospedada da mensagem de origem. Relay preserva a foto original; por
// isso só pode ser usado no modo histórico "Imagem que veio na mensagem".
// Quando a imagem precisa passar por canvas/padding, relay não serve: ele pula
// normalizeImageForWhatsApp e deixa o WhatsApp cortar o card como antes.
export function shouldRelayOriginalMediaForImageMode(imageMode, options = {}) {
  if ((imageMode ?? 'original') !== 'original') return false
  if (options.mediaType === 'imageMessage' && options.imageFit === 'contain') return false
  return true
}
