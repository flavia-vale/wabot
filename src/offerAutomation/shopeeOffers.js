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

export function filterOffers(offers, { minDiscountPct, excludeItemIds }) {
  const excludeSet = new Set(excludeItemIds.map(String))
  return offers.filter(o => {
    if (excludeSet.has(String(o.itemId))) return false
    const rate = Number(o.priceDiscountRate) || 0
    return rate > 0 && rate >= minDiscountPct
  })
}

export function buildOfferCandidateLimit(limit) {
  // Fetch more than offersPerSend because filters remove already-sent items
  // and products that do not meet the user's minimum discount threshold.
  return Math.min(Math.max(limit * 10, 20), 100)
}

export async function fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType = 2, isAMSOffer = false, isKeySeller = false }) {
  const { appId, secretKey } = creds
  const candidateLimit = buildOfferCandidateLimit(limit)
  const query = buildOffersQuery({ keyword, page: 1, limit: candidateLimit, sortType, listType: 1, isAMSOffer, isKeySeller })
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
  return { offers: filterOffers(nodes, { minDiscountPct, excludeItemIds }), rawCount: nodes.length }
}
