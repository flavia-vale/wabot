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

import { isPublishableFallbackImage, resolveMinPublishableImageBytes } from './core/thumbnailQualityPolicy.js'

export const MONITORED_THUMBNAIL_BYTES_THRESHOLD = 50_000

export function isLikelyJpegThumbnail(image) {
  if (!image?.buffer?.length) return false
  return image.buffer.length < MONITORED_THUMBNAIL_BYTES_THRESHOLD && image.mimetype === 'image/jpeg'
}

// Decide se o fetch ativo (imagem hi-res raspada da página do produto) deve ser
// PULADO para mensagens que mencionam cupom. Resolve com segurança a colisão
// entre dois casos que ambos casam isCouponAnnouncement() ("cupom" + CÓDIGO):
//
//   A. Cupom GENÉRICO ("NOVO CUPOM ML 🎟 cupom: GRAMADOVERDE"): o link resolve
//      para um produto ALEATÓRIO do marketplace. Buscar a imagem desse produto
//      mostraria a foto errada (regressão original do commit a1a2637).
//      → skipActiveFetch=true: usa a imagem original da mensagem upstream.
//
//   B. PRODUTO + cupom ("Tênis Polo Wear... Use o Cupom: VEMAPROVEITAR" + link
//      real do produto): o link resolve para O produto certo. Pular o fetch
//      mandaria o jpegThumbnail (~300px) borrado (regressão image-upload-bug-fix).
//      → skipActiveFetch=false: busca a imagem hi-res do produto.
//
// Discriminador SEGURO = overlap entre o título raspado do link e o caption
// (mesmo sinal do guard de title_mismatch). `titleOverlap`:
//   'match'    → caption descreve o produto (caso B)  → NÃO pular (busca hi-res)
//   'mismatch' → caption não bate com o produto (caso A) → pular
//   'unknown'  → não foi possível raspar (timeout, short link de cupom que não
//                resolve og:title, ou plataforma fora do guard, ex: Shopee).
//                Aqui NÃO temos confirmação do título, então decidimos pela
//                FORMA do caption (`looksGeneric`): cupom store-wide ("em
//                compras a partir de", "pesquise pelo produto desejado") →
//                pular (o link resolve p/ produto aleatório — regressão 2026-06
//                da camiseta branca); caption que nomeia um produto → manter a
//                aposta de produto e buscar hi-res (preserva Shopee/etc.
//                produto+cupom, que sempre cai em 'unknown' por estar fora do
//                guard de scrape).
//
// Mensagens não-cupom nunca pulam (comportamento histórico das ofertas normais).
export function decideSkipActiveFetchForCoupon({ isCouponMsg, hasProductLink, titleOverlap, looksGeneric = false }) {
  if (!isCouponMsg) return false
  if (!hasProductLink) return true
  if (titleOverlap === 'match') return false
  if (titleOverlap === 'mismatch') return true
  // titleOverlap === 'unknown': decide pela forma do caption.
  return !!looksGeneric
}

export async function resolveMonitoredImage({
  mode,
  target,
  credentials,
  downloadOriginalImage,
  fetchProductImage,
  fetchImageBuffer,
  fallbackToOriginal = true,
  skipActiveFetch = false,
  logger,
  minPublishableBytes = resolveMinPublishableImageBytes(),
  onThumbnailDropped = null,
}) {
  const log = logger || { info: () => {}, warn: () => {} }

  async function tryActiveFetch() {
    if (skipActiveFetch) return null
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

    // Última cartada: a thumbnail mesmo. Imagem ruim > nenhuma imagem — mas só
    // até o piso de qualidade (thumbnailQualityPolicy.js). Abaixo dele a foto
    // sai como borrão e o certo é NÃO publicar imagem: o envio degrada para o
    // card de link do WhatsApp, que fica legível. Ver RCA 2026-08-26.
    if (!downloaded) return null
    const verdict = isPublishableFallbackImage(downloaded, minPublishableBytes)
    if (!verdict.publish) {
      log.warn({ platform: target?.platform, bytes: verdict.bytes, minBytes: verdict.minBytes }, 'resolveMonitoredImage: miniatura pequena demais para publicar — enviando sem imagem')
      onThumbnailDropped?.({ platform: target?.platform, bytes: verdict.bytes, minBytes: verdict.minBytes })
      return null
    }
    return downloaded
  }

  if (mode === 'fetch') {
    const upgraded = await tryActiveFetch()
    if (upgraded) return upgraded
    if (fallbackToOriginal) {
      const downloaded = await downloadOriginalImage()
      if (downloaded) {
        const verdict = isPublishableFallbackImage(downloaded, minPublishableBytes)
        if (verdict.publish) return downloaded
        log.warn({ platform: target?.platform, bytes: verdict.bytes, minBytes: verdict.minBytes }, 'resolveMonitoredImage: miniatura pequena demais para publicar — enviando sem imagem')
        onThumbnailDropped?.({ platform: target?.platform, bytes: verdict.bytes, minBytes: verdict.minBytes })
      }
    }
    return null
  }

  return null
}
