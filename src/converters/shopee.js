import axios from 'axios'
import crypto from 'crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secretKey}`)
    .digest('hex')
  return {
    header: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`,
    timestamp,
  }
}

export async function convert(url, creds) {
  const { appId, secretKey } = creds
  const canonical = await resolveCanonical(url)
  const safeUrl = canonical.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const body = {
    query: `mutation {
      generateShortLink(input: { originUrl: "${safeUrl}", subIds: [""] }) {
        shortLink
      }
    }`,
  }
  const payload = JSON.stringify(body)
  const { header } = buildAuth(appId, secretKey, payload)

  try {
    const { data } = await axios.post(ENDPOINT, body, {
      headers: {
        Authorization: header,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    })

    const link = data?.data?.generateShortLink?.shortLink
    if (!link) {
      const err = data?.errors?.[0]?.message
      throw new Error(err || 'Resposta inesperada')
    }
    return link
  } catch (err) {
    throw new Error(`Shopee converter: ${err.message}`)
  }
}

// Resolve short links (shope.ee, s.shopee.com.br) para a URL canônica
// e extrai (shopid, itemid) — ambos no formato `-i.{shopid}.{itemid}`.
async function resolveCanonical(url) {
  try {
    const u = new URL(url)
    if (!/^(shope\.ee|s\.shopee\.com\.br)$/.test(u.hostname)) return url
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return res.url || url
  } catch { return url }
}

function parseIds(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/)
      || u.pathname.match(/^\/product\/(\d+)\/(\d+)(?:\/|$)/)
    if (!m) return null
    return { shopId: m[1], itemId: m[2] }
  } catch { return null }
}

// Consulta a API de afiliado (GraphQL) para obter a imagem oficial do produto.
// Mais confiável que scraping HTML, que a Shopee bloqueia para UAs comuns.
export async function fetchShopeeImage(url, creds) {
  if (!creds?.appId || !creds?.secretKey) return null
  const canonical = await resolveCanonical(url)
  const ids = parseIds(canonical)
  if (!ids) return null

  const body = {
    query: `{
      productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) {
        nodes { imageUrl productName }
      }
    }`,
  }
  const payload = JSON.stringify(body)
  const { header } = buildAuth(creds.appId, creds.secretKey, payload)

  try {
    const { data } = await axios.post(ENDPOINT, body, {
      headers: { Authorization: header, 'Content-Type': 'application/json' },
      timeout: 6000,
    })
    const node = data?.data?.productOfferV2?.nodes?.[0]
    return node?.imageUrl || null
  } catch {
    return null
  }
}
