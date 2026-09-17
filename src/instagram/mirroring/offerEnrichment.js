import { resolveMirrorOfferFromLink } from '../../core/mirrorTemplate.js'
import { extractCouponLine, extractTextPrice } from '../../core/mirrorTemplate.js'

// "R$ 1.299,90" / "1299,90" / "por 199" -> centavos. Devolve null quando não há
// número confiável — preço errado no Story é pior que preço ausente.
export function priceStringToCents(value) {
  const raw = String(value ?? '')
  const match = raw.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/)
  if (!match) return null
  const inteiro = Number(match[1].replace(/\./g, ''))
  if (!Number.isFinite(inteiro)) return null
  const centavos = match[2] ? Number(match[2].padEnd(2, '0')) : 0
  const cents = inteiro * 100 + centavos
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

function couponCodeFromText(text) {
  const line = extractCouponLine(String(text || ''))
  if (!line) return null
  const code = line.match(/\b([A-Z0-9]{4,20})\b/)?.[1]
  return code && !/^(CUPOM|CUPONS|OFF|USE|R)$/.test(code) ? code : null
}

/**
 * Completa o snapshot capturado pelo bot-worker com título, preço e loja reais.
 *
 * A captura no worker é deliberadamente rasa (nenhuma rede no hot path do
 * WhatsApp), então o título vinha do texto do grupo de origem — quase sempre o
 * banner ("OFERTA RELÂMPAGO") — e o preço não vinha. Aqui, já fora do worker,
 * usamos o MESMO caminho do template de espelhamento do WhatsApp, para o Story
 * e a mensagem do grupo contarem a mesma história.
 *
 * Nada disso é obrigatório: falha de scrape mantém o snapshot como veio.
 */
export async function enrichMirrorOffer(offer, { credentialsMap = {}, resolver = resolveMirrorOfferFromLink, logger = null } = {}) {
  const sourceText = offer?.attributes?.sourceText || ''
  const enriched = { ...offer }
  const couponCode = couponCodeFromText(sourceText)
  if (couponCode && !enriched.couponCode) enriched.couponCode = couponCode

  let resolved = null
  try {
    resolved = await resolver({
      originalUrl: offer?.attributes?.sourceUrl || '',
      convertedUrl: offer?.productUrl || '',
      platform: offer?.attributes?.sourcePlatform || null,
      credentialsMap,
    })
  } catch (error) {
    logger?.warn?.({ err: error?.message }, 'Espelhamento Instagram: scrape de título/preço falhou')
  }

  if (resolved?.title) enriched.title = resolved.title
  if (resolved?.storeName) enriched.storeName = resolved.storeName
  const priceCents = priceStringToCents(resolved?.price)
  const oldPriceCents = priceStringToCents(resolved?.oldPrice)
  if (priceCents != null) enriched.priceCents = priceCents
  if (oldPriceCents != null && (priceCents == null || oldPriceCents >= priceCents)) enriched.oldPriceCents = oldPriceCents

  // Plano B: quando a loja não devolve preço, a copy do grupo de origem quase
  // sempre traz o "De/Por". É a mesma fonte que o template do WhatsApp usa.
  if (enriched.priceCents == null && sourceText) {
    const fromText = extractTextPrice(sourceText)
    const numbers = String(fromText).match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g) || []
    const cents = numbers.map(priceStringToCents).filter(value => value != null)
    if (cents.length) {
      enriched.priceCents = Math.min(...cents)
      const maior = Math.max(...cents)
      if (maior > enriched.priceCents) enriched.oldPriceCents = maior
    }
  }
  return enriched
}
