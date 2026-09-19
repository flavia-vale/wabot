import axios from 'axios'
import crypto from 'crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secretKey}`)
    .digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`
}

// listType=1 keeps the search broad enough for keyword automations.
// listType=2 (top performance) is narrower and caused false no_offers_found skips.
export function buildOffersQuery({ keyword, page, limit, sortType = 2, listType = 1, isAMSOffer = false, isKeySeller = false }) {
  const safeKeyword = keyword.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r]/g, ' ')
  const amsParam = isAMSOffer ? ', isAMSOffer: true' : ''
  const keySellerParam = isKeySeller ? ', isKeySeller: true' : ''
  return `{
    productOfferV2(
      keyword: "${safeKeyword}",
      listType: ${listType},
      sortType: ${sortType},
      page: ${page},
      limit: ${limit}${amsParam}${keySellerParam}
    ) {
      nodes {
        itemId shopId productName imageUrl offerLink
        price priceMin priceMax priceDiscountRate
        commissionRate sales ratingStar
      }
    }
  }`
}

// Por que cada oferta da Shopee foi descartada. O descarte por preço ausente
// nasceu MUDO: uma automação podia parar de enviar porque a Shopee devolveu
// preço vazio em tudo, e do lado de fora isso é idêntico a "não achei oferta
// com desconto" — que pede outra ação (baixar o desconto mínimo). Contar por
// motivo é o que separa os dois sem ninguém precisar abrir o log da Shopee.
export const OFFER_DROP_REASON = Object.freeze({
  ALREADY_SENT: 'ja_enviada',
  NO_PRICE: 'sem_preco',
  BELOW_DISCOUNT: 'desconto_abaixo_do_minimo',
})

/**
 * @param {object} [counters] mapa opcional motivo → quantidade, preenchido aqui.
 *   Função continua PURA quanto ao resultado: o mapa é só instrumentação.
 */
export function filterOffers(offers, { minDiscountPct, excludeItemIds }, counters = null) {
  const excludeSet = new Set(excludeItemIds.map(String))
  const drop = (reason) => {
    if (counters) counters[reason] = (counters[reason] ?? 0) + 1
    return false
  }
  return offers.filter(o => {
    if (excludeSet.has(String(o.itemId))) return drop(OFFER_DROP_REASON.ALREADY_SENT)
    // productOfferV2 occasionally returns an offer with a discount but with
    // every price field empty/null. Such an item cannot produce a truthful
    // preview or publication, so discard it at the API boundary instead of
    // allowing the formatter to silently omit the price line.
    if (resolveShopeeOfferPrice(o) === null) return drop(OFFER_DROP_REASON.NO_PRICE)
    const rate = Number(o.priceDiscountRate) || 0
    if (!(rate > 0 && rate >= minDiscountPct)) return drop(OFFER_DROP_REASON.BELOW_DISCOUNT)
    return true
  })
}

// Affiliate responses are not consistent about which of the three price
// fields is populated. Empty strings must not win over a valid fallback, and
// zero/negative/non-numeric values are not usable product prices.
export function resolveShopeeOfferPrice(offer = {}) {
  for (const value of [offer.priceMin, offer.price, offer.priceMax]) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

// A API de afiliado da Shopee frequentemente retorna o MESMO produto sob
// itemIds diferentes (lojas/variações distintas) — mesmo productName, preço
// ligeiramente diferente. A dedup por itemId (filterOffers/sentItemIds) não
// pega esse caso, então o mesmo anúncio saía duas vezes seguidas no grupo.
// Aqui colapsamos por identidade de produto (nome normalizado), mantendo a
// primeira ocorrência (que respeita a ordem de prioridade/sort já aplicada).
export function productDedupKey(offer) {
  const name = String(offer?.productName ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return name || `item:${offer?.itemId ?? ''}`
}

export function dedupeOffersByProduct(offers, seenKeys = new Set()) {
  const result = []
  for (const offer of offers) {
    const key = productDedupKey(offer)
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    result.push(offer)
  }
  return result
}

export function buildOfferCandidateLimit(limit) {
  // Fetch more than offersPerSend because filters remove already-sent items
  // and products that do not meet the user's minimum discount threshold.
  // A API de afiliados rejeita qualquer `limit` acima de 50 (erro 11001),
  // portanto este teto precisa valer para preview, envio direto e revisão.
  return Math.min(Math.max(limit * 10, 20), 50)
}

export async function fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType = 2, listType = 1, page = 1, isAMSOffer = false, isKeySeller = false }) {
  const { appId, secretKey } = creds
  const candidateLimit = buildOfferCandidateLimit(limit)
  const query = buildOffersQuery({ keyword, page, limit: candidateLimit, sortType, listType, isAMSOffer, isKeySeller })
  const body = { query }
  const payload = JSON.stringify(body)
  const authHeader = buildAuth(appId, secretKey, payload)

  const { data } = await axios.post(ENDPOINT, body, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    timeout: 10000,
  })

  // A API de afiliado da Shopee responde 200 mesmo em erro, sinalizando via
  // `errors` (ex.: credencial inválida, assinatura errada, error 90309999,
  // rate limit). Sem este check, `data.data` vem null, nodes = [] e o erro
  // real se disfarçava de "no_offers_found". Propagamos para o chamador.
  if (Array.isArray(data?.errors) && data.errors.length) {
    const detail = data.errors
      .map(e => [e.code, e.message].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('; ') || 'erro desconhecido'
    throw new Error(`shopee_api_error: ${detail}`)
  }

  const nodes = data?.data?.productOfferV2?.nodes ?? []
  const dropped = {}
  const offers = filterOffers(nodes, { minDiscountPct, excludeItemIds }, dropped)
  // Lote inteiro descartado por preço ausente é defeito do lado da Shopee, não
  // configuração da cliente — e sem esta linha a automação só "emudece".
  if (dropped[OFFER_DROP_REASON.NO_PRICE] > 0) {
    console.warn(`[shopee-offers] ${dropped[OFFER_DROP_REASON.NO_PRICE]} de ${nodes.length} ofertas descartadas por virem sem preço`)
  }
  return { offers, rawCount: nodes.length, dropped }
}
