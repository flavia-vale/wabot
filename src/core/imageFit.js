export const WHATSAPP_SAFE_IMAGE_SIZE = 1200
export const WHATSAPP_SAFE_THUMBNAIL_SIZE = 500

export const WHATSAPP_SAFE_IMAGE_BACKGROUND = Object.freeze({
  r: 255,
  g: 255,
  b: 255,
  alpha: 1,
})

export function shouldContainImageForWhatsApp(policy) {
  return policy === 'contain'
}

export function buildContainedImageResizeOptions(size = WHATSAPP_SAFE_IMAGE_SIZE) {
  return {
    width: size,
    height: size,
    fit: 'contain',
    withoutEnlargement: true,
    background: WHATSAPP_SAFE_IMAGE_BACKGROUND,
  }
}
