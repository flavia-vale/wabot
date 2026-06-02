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
        price priceMin priceMax originPrice priceDiscountRate
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
    const origin = Number(o.originPrice) || 0
    const current = Number(o.priceMin ?? o.price) || 0
    const hasRealDiscount = rate > 0 || (origin > 0 && current > 0 && current < origin)
    if (!hasRealDiscount) return false
    return rate >= minDiscountPct
  })
}

export function buildOfferCandidateLimit(limit) {
  // Fetch more than offersPerSend because filters remove already-sent items
  // and products that do not meet the user's minimum discount threshold.
  return Math.min(Math.max(limit * 10, 20), 100)
}

export const SEARCH_RESULT_LIMIT = 20

// Faz a chamada bruta ao productOfferV2 e devolve os nodes crus, propagando
// erro real da API. Compartilhado entre fetchOffers (envio real) e
// searchOffersRaw (painel de teste).
async function requestOfferNodes({ creds, keyword, page, limit, sortType, listType, isAMSOffer, isKeySeller }) {
  const { appId, secretKey } = creds
  const query = buildOffersQuery({ keyword, page, limit, sortType, listType, isAMSOffer, isKeySeller })
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

  return data?.data?.productOfferV2?.nodes ?? []
}

export async function fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType = 2, isAMSOffer = false, isKeySeller = false }) {
  const candidateLimit = buildOfferCandidateLimit(limit)
  const nodes = await requestOfferNodes({ creds, keyword, page: 1, limit: candidateLimit, sortType, listType: 1, isAMSOffer, isKeySeller })
  return { offers: filterOffers(nodes, { minDiscountPct, excludeItemIds }), rawCount: nodes.length }
}

// Busca de teste: roda a query exatamente com os parâmetros que o usuário
// escolheu (nada hardcoded além de page 1 e do limite de 20) e devolve os
// resultados CRUS — sem filtro de desconto nem dedup.
export async function searchOffersRaw({ keyword, creds, sortType = 2, listType = 1, isAMSOffer = false, isKeySeller = false, limit = SEARCH_RESULT_LIMIT }) {
  const nodes = await requestOfferNodes({ creds, keyword, page: 1, limit, sortType, listType, isAMSOffer, isKeySeller })
  return nodes.slice(0, limit)
}
