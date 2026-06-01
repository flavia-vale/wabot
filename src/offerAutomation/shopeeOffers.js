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

export function buildOffersQuery({ keyword, page, limit, sortType = 2, isAMSOffer = false, isKeySeller = false }) {
  const safeKeyword = keyword.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const amsParam = isAMSOffer ? ', isAMSOffer: true' : ''
  const keySellerParam = isKeySeller ? ', isKeySeller: true' : ''
  return `{
    productOfferV2(
      keyword: "${safeKeyword}",
      listType: 2,
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

export async function fetchOffers({ keyword, minDiscountPct, limit, excludeItemIds, creds, sortType = 2, isAMSOffer = false, isKeySeller = false }) {
  const { appId, secretKey } = creds
  const query = buildOffersQuery({ keyword, page: 1, limit: Math.min(limit * 4, 100), sortType, isAMSOffer, isKeySeller })
  const body = { query }
  const payload = JSON.stringify(body)
  const authHeader = buildAuth(appId, secretKey, payload)

  const { data } = await axios.post(ENDPOINT, body, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    timeout: 10000,
  })

  const nodes = data?.data?.productOfferV2?.nodes ?? []
  return filterOffers(nodes, { minDiscountPct, excludeItemIds })
}
