// Resolve a melhor imagem possível para uma mensagem monitorada.
//
// Trade-off central: a mensagem origem frequentemente é um extendedTextMessage
// com link preview cuja jpegThumbnail (~5KB, ~300px) fica pixelada quando o
// WhatsApp amplia no card. Mas confiar só no preview automático do WhatsApp
// (generateHighQualityLinkPreview) falha em URLs de afiliado encurtadas/tracker.
//
// Esta função aplica a seguinte prioridade:
//   1. Imagem cheia decodificada da mensagem origem (imageMessage real ou
//      quoted). Sai direto — alta qualidade garantida.
//   2. Upgrade ativo: busca o og:image/imagem oficial direto da página do
//      marketplace (Shopee/Amazon/Mercado Livre/Magalu) e baixa em alta
//      resolução com os helpers do imageScrapers.
//   3. Fallback: a jpegThumbnail original (melhor que nenhuma imagem).
//
// O limiar de 50KB separa "thumbnail do link preview" de "imageMessage real
// comprimido pelo WhatsApp" — abaixo disso é quase certo que seja preview.

export const MONITORED_THUMBNAIL_BYTES_THRESHOLD = 50_000

export function isLikelyJpegThumbnail(image) {
  if (!image?.buffer?.length) return false
  return image.buffer.length < MONITORED_THUMBNAIL_BYTES_THRESHOLD && image.mimetype === 'image/jpeg'
}

export async function resolveMonitoredImage({
  mode,
  target,
  credentials,
  downloadOriginalImage,
  fetchProductImage,
  fetchImageBuffer,
  fallbackToOriginal = true,
  logger,
}) {
  const log = logger || { info: () => {}, warn: () => {} }

  async function tryActiveFetch() {
    if (!target?.url) return null
    try {
      const productImageUrl = await fetchProductImage(target.platform, target.url, credentials || {})
      log.info({ platform: target.platform, productImageUrl }, 'resolveMonitoredImage: fetchProductImage')
      if (!productImageUrl) return null
      const fetched = await fetchImageBuffer(productImageUrl, target.url)
      if (fetched?.buffer?.length) {
        log.info({ platform: target.platform, size: fetched.buffer.length }, 'resolveMonitoredImage: imagem alta-res obtida via marketplace')
        return fetched
      }
      return null
    } catch (err) {
      log.warn({ err: err.message, platform: target.platform }, 'resolveMonitoredImage: falha no fetch ativo')
      return null
    }
  }

  if (mode === 'original') {
    const downloaded = await downloadOriginalImage()

    // Imagem cheia da origem — usa direto, sem custo de rede extra.
    if (downloaded && !isLikelyJpegThumbnail(downloaded)) {
      return downloaded
    }

    // Só veio jpegThumbnail (ou nada). Tenta upgrade ativo.
    const upgraded = await tryActiveFetch()
    if (upgraded) return upgraded

    // Última cartada: a thumbnail mesmo. Imagem ruim > nenhuma imagem.
    return downloaded || null
  }

  if (mode === 'fetch') {
    const upgraded = await tryActiveFetch()
    if (upgraded) return upgraded
    if (fallbackToOriginal) {
      const downloaded = await downloadOriginalImage()
      if (downloaded) return downloaded
    }
    return null
  }

  return null
}
