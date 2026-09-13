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
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  for (const word of words) {
    if (!lines.length || `${lines.at(-1)} ${word}`.length > maxChars) lines.push(word)
    else lines[lines.length - 1] += ` ${word}`
  }
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(1, maxChars - 1)).trim()}…`
  }
  return lines
}

function overlaySvg(offer, t) {
  const chars = Math.max(12, Math.floor(t.title.width / (t.title.fontSize * 0.56)))
  const titleLines = wrap(offer.title, chars, t.title.maxLines)
  const title = titleLines.map((line, i) => `<text x="${t.title.left}" y="${t.title.top + i * (t.title.fontSize + 12)}" class="title">${escapeXml(line)}</text>`).join('')
  const priceY = t.title.top + titleLines.length * (t.title.fontSize + 12) + 55
  const oldPrice = offer.oldPriceCents == null ? '' : `<text x="90" y="${priceY}" class="old">De ${escapeXml(brl(offer.oldPriceCents))}</text>`
  const coupon = offer.couponCode ? `<rect x="90" y="${priceY + 170}" width="900" height="110" rx="24" fill="${t.accent}"/><text x="540" y="${priceY + 244}" text-anchor="middle" class="coupon">CUPOM ${escapeXml(offer.couponCode)}</text>` : ''
  // A Content Publishing API não garante um link clicável neste asset. O
  // fallback precisa ser honesto e neutro; CTA de clique só entra quando o
  // produto fornecer explicitamente uma estratégia compatível.
  return Buffer.from(`<svg width="${STORY_WIDTH}" height="${STORY_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><style>.title{font:700 ${t.title.fontSize}px sans-serif;fill:${t.text}}.old{font:36px sans-serif;fill:${t.muted}}.price{font:800 86px sans-serif;fill:${t.accent}}.coupon{font:700 42px sans-serif;fill:#fff}.cta{font:700 38px sans-serif;fill:${t.text}}</style>${title}${oldPrice}<text x="90" y="${priceY + 100}" class="price">${escapeXml(brl(offer.priceCents))}</text>${coupon}<text x="540" y="1810" text-anchor="middle" class="cta">${escapeXml(offer.callToAction || 'Oferta por tempo limitado')}</text></svg>`)
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
