import sharp from 'sharp'
import { createHash } from 'node:crypto'

import { createCanonicalOffer } from '../../domain/delivery/canonicalOffer.js'
import { escapeXml } from '../../core/destinationWatermark.js'
import { DEFAULT_STORY_TEMPLATE, STORY_HEIGHT, STORY_MIME_TYPE, STORY_WIDTH, normalizeStoryTemplate, storyTemplateHash } from './template.js'

const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

function brl(cents) {
  if (cents == null) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function wrap(text, maxChars, maxLines) {
  // Quebra por code point: `.split('')`/`.slice` contam code UNITS e partiriam
  // emoji ao meio (mesma lição do RCA 2026-09-11 da chave de dedup).
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').flatMap(word => {
    const points = [...word]
    if (points.length <= maxChars) return [word]
    // Palavra maior que a linha (URL, código de produto) precisa ser partida,
    // senão o texto sai do canvas sem aviso — o SVG não recorta, só extrapola.
    const pieces = []
    for (let i = 0; i < points.length; i += maxChars) pieces.push(points.slice(i, i + maxChars).join(''))
    return pieces
  })
  const lines = []
  for (const word of words) {
    if (!lines.length || [...`${lines.at(-1)} ${word}`].length > maxChars) lines.push(word)
    else lines[lines.length - 1] += ` ${word}`
  }
  if (lines.length > maxLines) {
    lines.length = maxLines
    const points = [...lines[maxLines - 1]]
    lines[maxLines - 1] = `${points.slice(0, Math.max(1, maxChars - 1)).join('').trim()}\u2026`
  }
  return lines
}

// A Content Publishing API da Meta NÃO cria sticker de link clicável: o Story
// publicado por API é imagem pura. Por isso o card precisa dizer, em texto,
// ONDE a pessoa encontra a oferta — senão publicamos uma peça sem saída e sem
// comissão. `callToAction` do produto vence; o padrão é honesto e não promete
// clique.
export const DEFAULT_STORY_CALL_TO_ACTION = 'Link na bio \u2022 chame no direct'

export function storyCallToAction(offer) {
  const custom = typeof offer?.callToAction === 'string' ? offer.callToAction.trim() : ''
  return custom || DEFAULT_STORY_CALL_TO_ACTION
}

// Monta o overlay de baixo para cima a partir do rodapé do canvas, em vez de
// empilhar deslocamentos fixos a partir do título. Antes o preço, o cupom e a
// CTA saíam do canvas em silêncio quando o título ocupava 3 linhas ou quando o
// template subia `title.top` — a validação só olhava o título.
const FOOTER_MARGIN = 96
const CTA_FONT = 38
const COUPON_HEIGHT = 110
const PRICE_FONT = 86
const OLD_PRICE_FONT = 36
const STORE_FONT = 34

function overlaySvg(offer, t) {
  const left = t.title.left
  const chars = Math.max(12, Math.floor(t.title.width / (t.title.fontSize * 0.56)))
  const titleLines = wrap(offer.title, chars, t.title.maxLines)
  const title = titleLines
    .map((line, i) => `<text x="${left}" y="${t.title.top + i * (t.title.fontSize + 12)}" class="title">${escapeXml(line)}</text>`)
    .join('')

  // Rodapé para cima: CTA, cupom, preço, "de R$", loja.
  let cursor = STORY_HEIGHT - FOOTER_MARGIN
  const cta = `<text x="${STORY_WIDTH / 2}" y="${cursor}" text-anchor="middle" class="cta">${escapeXml(storyCallToAction(offer))}</text>`
  cursor -= CTA_FONT + 40

  let coupon = ''
  if (offer.couponCode) {
    const top = cursor - COUPON_HEIGHT
    coupon = `<rect x="${left}" y="${top}" width="${STORY_WIDTH - left * 2}" height="${COUPON_HEIGHT}" rx="24" fill="${t.accent}"/>`
      + `<text x="${STORY_WIDTH / 2}" y="${top + 74}" text-anchor="middle" class="coupon">CUPOM ${escapeXml(offer.couponCode)}</text>`
    cursor = top - 36
  }

  // Preço ausente (espelhamento sem scrape) não pode virar um vão em branco no
  // meio do card: cai para "Confira o preço", que é honesto.
  const priceLabel = offer.priceCents == null ? 'Confira o preço' : brl(offer.priceCents)
  const price = `<text x="${left}" y="${cursor}" class="price">${escapeXml(priceLabel)}</text>`
  cursor -= PRICE_FONT

  const oldPrice = offer.oldPriceCents == null || offer.oldPriceCents === offer.priceCents
    ? ''
    : `<text x="${left}" y="${cursor}" class="old">De ${escapeXml(brl(offer.oldPriceCents))}</text>`
  if (oldPrice) cursor -= OLD_PRICE_FONT + 10

  // Nome da loja: sem ele o Story publicado não diz de onde é a oferta, e o
  // Story não tem link clicável para a pessoa descobrir.
  const badge = [offer.storeName, offer.discountLabel].filter(Boolean).join('  \u00b7  ')
  const store = badge ? `<text x="${left}" y="${cursor}" class="store">${escapeXml(badge.toUpperCase())}</text>` : ''

  const style = `<style>`
    + `.title{font:700 ${t.title.fontSize}px sans-serif;fill:${t.text}}`
    + `.store{font:700 ${STORE_FONT}px sans-serif;fill:${t.accent};letter-spacing:2px}`
    + `.old{font:${OLD_PRICE_FONT}px sans-serif;fill:${t.muted};text-decoration:line-through}`
    + `.price{font:800 ${PRICE_FONT}px sans-serif;fill:${t.accent}}`
    + `.coupon{font:700 42px sans-serif;fill:#fff}`
    + `.cta{font:700 ${CTA_FONT}px sans-serif;fill:${t.text}}`
    + `</style>`
  return Buffer.from(`<svg width="${STORY_WIDTH}" height="${STORY_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${style}${title}${store}${oldPrice}${price}${coupon}${cta}</svg>`)
}

export async function renderInstagramStory({ offer: rawOffer, productImage, template = DEFAULT_STORY_TEMPLATE, quality = 88 } = {}) {
  const offer = createCanonicalOffer(rawOffer)
  const t = normalizeStoryTemplate(template)
  if (!Buffer.isBuffer(productImage) || !productImage.length) throw new TypeError('productImage deve ser um Buffer não vazio')
  if (productImage.length > MAX_SOURCE_BYTES) throw new RangeError('productImage excede 15 MB')
  if (!Number.isInteger(quality) || quality < 60 || quality > 95) throw new TypeError('quality deve estar entre 60 e 95')

  const product = await sharp(productImage, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate().resize(t.product.width, t.product.height, { fit: 'contain', background: t.panel }).jpeg({ quality: 92 }).toBuffer()
  const background = await sharp({ create: { width: STORY_WIDTH, height: STORY_HEIGHT, channels: 3, background: t.background } })
    .composite([
      { input: product, left: t.product.left, top: t.product.top },
      { input: overlaySvg(offer, t), left: 0, top: 0 },
    ]).jpeg({ quality, chromaSubsampling: '4:4:4' }).withMetadata({ orientation: 1 }).toBuffer()
  if (background.length > MAX_OUTPUT_BYTES) throw new RangeError('Story renderizado excede 8 MB')
  const metadata = await sharp(background).metadata()
  return Object.freeze({
    buffer: background,
    mimeType: STORY_MIME_TYPE,
    width: metadata.width,
    height: metadata.height,
    byteSize: background.length,
    contentHash: createHash('sha256').update(background).digest('hex'),
    templateHash: storyTemplateHash(t),
    templateKey: t.key,
    templateVersion: t.version,
  })
}
