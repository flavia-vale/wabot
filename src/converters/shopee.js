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
// e normaliza para o formato que a API de afiliado aceita como origem.
//
// Shopee BR ressuscitou em 2026 um shortlink no formato `/opaanlp/{shopId}/{itemId}`
// (campanha "Open Anuncio Link de Produto") já carimbado como afiliado de
// terceiros (`utm_medium=affiliates&utm_source=an_<id>` + assinatura
// `gads_t_sig`). A `generateShortLink` recusa URLs assim com "Invalid origin URL"
// porque o programa não reetiqueta link de outro afiliado. Solução: extrair
// (shopId, itemId) do path e reescrever para `/product/{shopId}/{itemId}` sem
// query string — formato canônico aceito.
const SHOPEE_PRODUCT_PATH_RE = /\/(?:opaanlp|product|universal-link\/product)\/(\d+)\/(\d+)(?:\/|$)/
const SHOPEE_DASH_I_RE = /-i\.(\d+)\.(\d+)(?:\/|$)/

export function normalizeShopeeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    if (!/(^|\.)shopee\.com\.br$/.test(u.hostname)) return rawUrl
    const dashI = u.pathname.match(SHOPEE_DASH_I_RE)
    if (dashI) {
      return `https://shopee.com.br/product/${dashI[1]}/${dashI[2]}`
    }
    const prod = u.pathname.match(SHOPEE_PRODUCT_PATH_RE)
    if (prod) {
      return `https://shopee.com.br/product/${prod[1]}/${prod[2]}`
    }
    return rawUrl
  } catch { return rawUrl }
}

async function resolveCanonical(url) {
  try {
    const u = new URL(url)
    const isShort = /^(shope\.ee|s\.shopee\.com\.br)$/.test(u.hostname)
    const resolved = isShort
      ? (await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })).url || url
      : url
    return normalizeShopeeUrl(resolved)
  } catch { return url }
}

function parseIds(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(SHOPEE_DASH_I_RE)
      || u.pathname.match(SHOPEE_PRODUCT_PATH_RE)
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

function shopeePriceToString(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return (num / 100000).toFixed(2).replace('.', ',')
}

// Consulta a API de afiliado (GraphQL) para obter título e preço do produto.
// Retorna { title, newPrice, oldPrice } ou null em caso de falha/sem creds.
export async function fetchShopeeProductInfo(url, creds) {
  if (!creds?.appId || !creds?.secretKey) return null
  try {
    const canonical = await resolveCanonical(url)
    const ids = parseIds(canonical)
    if (!ids) return null

    const body = {
      query: `{
        productOfferV2(itemId: ${ids.itemId}, shopId: ${ids.shopId}, listType: 0, sortType: 2, page: 1, limit: 1) {
          nodes { imageUrl productName price priceMin priceMax priceDiscountRate originPrice }
        }
      }`,
    }
    const payload = JSON.stringify(body)
    const { header } = buildAuth(creds.appId, creds.secretKey, payload)

    const { data } = await axios.post(ENDPOINT, body, {
      headers: { Authorization: header, 'Content-Type': 'application/json' },
      timeout: 6000,
    })
    const node = data?.data?.productOfferV2?.nodes?.[0]
    if (!node) return null

    const title = typeof node.productName === 'string' ? node.productName.trim() : ''
    const currentRaw = node.priceMin ?? node.price ?? null
    const originalRaw = node.originPrice ?? null
    const newPrice = shopeePriceToString(currentRaw)
    const oldPrice = shopeePriceToString(originalRaw)

    if (!title && !newPrice) return null
    return { title, newPrice, oldPrice }
  } catch {
    return null
  }
}
