// Scraper de informação de produto a partir do link (já-afiliado).
// A ferramenta "Gerar oferta" recebe um link que JÁ é de afiliado — não deve
// re-converter. Aqui buscamos título e preços para preencher o template.

import { fetchShopeeProductInfo, extractShopeeIds, isShopeeShortLink, resolveShopeeShortLink } from './shopee.js'
import { resolveToCleanProductUrl } from './mercadolivre.js'
import { isAmazonShortLink, resolveAmazonShortLink } from './amazon.js'
import { buildOAuthRefreshDecision, applyOAuthTokenResponse } from './mlOAuthTokenPolicy.js'
import { withMercadoLivreCredentialLock } from './mercadolivreCredentialLock.js'

const HTML_FETCH_TIMEOUT_MS = Number(process.env.PRODUCT_INFO_TIMEOUT_MS) || 8_000
const HTML_MAX_BYTES = Number(process.env.PRODUCT_INFO_MAX_BYTES) || 2 * 1024 * 1024
const AMAZON_CAPTCHA_MAX_RETRIES = Number(process.env.AMAZON_CAPTCHA_MAX_RETRIES) || 4
const AMAZON_CAPTCHA_RETRY_DELAY_MS = Number(process.env.AMAZON_CAPTCHA_RETRY_DELAY_MS) || 150
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

let _mlAppTokenCache = { token: null, expiresAt: 0 }
async function getMlAppToken() {
  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  if (_mlAppTokenCache.token && Date.now() < _mlAppTokenCache.expiresAt) return _mlAppTokenCache.token
  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data?.access_token) return null
    _mlAppTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
    return _mlAppTokenCache.token
  } catch {
    return null
  }
}

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const OG_TITLE_RE = [
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
]
const TITLE_TAG_RE = /<title[^>]*>([^<]+)<\/title>/i
const META_PRICE_RE = [
  /<meta[^>]+(?:property|itemprop)=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+(?:property|itemprop)=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+(?:property|itemprop)=["']price["'][^>]+content=["']([^"']+)["']/i,
]

function decodeEntities(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function normalizeText(value) {
  return decodeEntities(value || '').replace(/\s+/g, ' ').trim()
}

function toPriceString(value) {
  if (value == null) return ''
  const num = Number(value)
  if (Number.isFinite(num) && num > 0) return num.toFixed(2).replace('.', ',')
  const cleaned = String(value).trim()
  return cleaned || ''
}

async function readLimitedText(res) {
  const contentLength = Number(res.headers.get('content-length'))
  if (contentLength && contentLength > HTML_MAX_BYTES) return null
  if (!res.body) return res.text()
  const reader = res.body.getReader()
  const chunks = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    chunks.push(value)
    if (received > HTML_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      break
    }
  }
  const body = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

// UA mobile usado nas chamadas autenticadas ao ML — uma sessão logada
// (cookie ssid) com esse UA evita o desafio anti-bot "suspicious-traffic"
// que devolve a página /gz/account-verification em requests anônimos.
const ML_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'

// UAs de crawler que a Shopee atende com SSR (HTML com og:title e JSON-LD com
// preço). Para UAs comuns de browser o SPA devolve shell vazio. Mesma lista
// comprovada em produção para imagens (imageScrapers.js).
const SHOPEE_CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.10.85 A',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

// Heurística: o shell SPA da Shopee (~13KB) não tem dados de produto.
// NOTA: verificamos presença de dados de produto ANTES do tamanho — uma
// resposta SSR de crawler pode ser um HTML mínimo mas com JSON-LD/og:title
// válidos, e isso NÃO é shell.
function isShopeeSpaShell(html) {
  if (!html) return true
  // Se há JSON-LD de produto ou og:title não-genérico, é SSR real.
  if (extractFromJsonLd(html)) return false
  const ogTitle = OG_TITLE_RE.map(re => re.exec(html)).find(m => m)?.[1]?.trim() || ''
  if (ogTitle && !/^shopee/i.test(ogTitle)) return false
  // Shell SPA da Shopee: pequeno OU sem dados de produto.
  if (html.length < 5_000) return true
  if (/<title[^>]*>\s*shopee/i.test(html) && !html.includes('"price_min"')) return true
  return false
}

async function fetchShopeeSSRHtml(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  for (const ua of SHOPEE_CRAWLER_UAS) {
    try {
      const result = await fetchHtml(url, { ua, timeoutMs })
      if (result?.html && !isShopeeSpaShell(result.html)) return result
    } catch {
      // próximo UA
    }
  }
  return null
}

const ML_CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

// Heurística: o HTML anti-bot do ML (/gz/account-verification) não tem
// marcadores de produto. Uma página de produto real sempre tem ui-pdp ou
// andes-money-amount. A presença desses marcadores tem prioridade sobre o
// tamanho — HTML curto com ui-pdp é produto válido (ex.: mocks de teste).
function isMercadoLivreAntiBotHtml(html) {
  if (!html) return true
  // Presença de marcadores de produto → não é anti-bot
  if (html.includes('ui-pdp') || html.includes('andes-money-amount')) return false
  // Sem marcadores de produto: HTML pequeno ou com sinais anti-bot explícitos
  if (html.length < 20_000) return true
  return /<title[^>]*>\s*Mercado Lib/i.test(html) || html.includes('gz-verify') || html.includes('account-verification')
}

function isMercadoLivreUrl(url) {
  try {
    return /(^|\.)mercado(livre|libre)\.com(\.br)?$/i.test(new URL(String(url)).hostname)
  } catch {
    return false
  }
}

// Monta o header Cookie a partir das credenciais de sessão do ML
// (mesmo formato usado por src/converters/mercadolivre.js).
function buildMlCookieHeader(creds) {
  if (!creds || typeof creds !== 'object') return ''
  if (creds.cookie) return String(creds.cookie)
  const pairs = []
  if (creds.id) pairs.push(`id=${creds.id}`)
  if (creds.csrf) pairs.push(`_csrf=${creds.csrf}`)
  if (creds.ssid) pairs.push(`ssid=${creds.ssid}`)
  return pairs.join('; ')
}

async function fetchHtml(url, { ua = BROWSER_UA, timeoutMs = HTML_FETCH_TIMEOUT_MS, cookieHeader = '' } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) return { html: null, finalUrl: res.url || url }
  const contentType = res.headers.get('content-type') || ''
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return { html: null, finalUrl: res.url || url }
  }
  const html = await readLimitedText(res)
  return { html, finalUrl: res.url || url }
}

function findProductNodes(html) {
  const nodes = []
  for (const match of html.matchAll(JSON_LD_RE)) {
    let parsed
    try { parsed = JSON.parse(match[1]) } catch { continue }
    const queue = Array.isArray(parsed) ? [...parsed] : [parsed]
    while (queue.length) {
      const node = queue.shift()
      if (!node || typeof node !== 'object') continue
      if (Array.isArray(node['@graph'])) queue.push(...node['@graph'])
      const type = node['@type']
      const types = Array.isArray(type) ? type : [type]
      if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('product'))) {
        nodes.push(node)
      }
    }
  }
  return nodes
}

function pickOffer(offers) {
  if (!offers) return null
  const list = Array.isArray(offers) ? offers : [offers]
  for (const offer of list) {
    if (offer && typeof offer === 'object') return offer
  }
  return null
}

function extractFromJsonLd(html) {
  const products = findProductNodes(html)
  for (const product of products) {
    const title = normalizeText(product.name)
    const offer = pickOffer(product.offers)
    const newPrice = toPriceString(offer?.price ?? offer?.lowPrice)
    // priceSpecification pode trazer o preço cheio (de) — costuma estar no
    // próprio nó offer ou em offer.priceSpecification quando é AggregateOffer.
    let oldPrice = ''
    const specs = offer?.priceSpecification
    if (Array.isArray(specs)) {
      for (const spec of specs) {
        if (spec?.priceType && /list|original|strikethrough/i.test(String(spec.priceType))) {
          oldPrice = toPriceString(spec.price)
          break
        }
      }
    } else if (specs && typeof specs === 'object') {
      oldPrice = toPriceString(specs.price)
    }
    if (!oldPrice) oldPrice = toPriceString(offer?.highPrice)
    if (title || newPrice) return { title, oldPrice, newPrice }
  }
  return null
}

const BOGUS_SCRAPE_TITLES = [
  'amazon.com.br',
  'mercado livre',
  'mercado livre brasil',
  // Grafia espanhola: é o og:title da página anti-bot/verificação do ML
  // (/gz/account-verification). Sem isso, um scrape bloqueado vaza
  // "Mercado Libre" como título de produto na oferta.
  'mercado libre',
  'mercado libre brasil',
  'shopee brasil',
  'shopee',
  'página não encontrada',
  'acesso negado',
  'access denied',
  'robot check',
  '404',
]

// Páginas anti-bot/interstício servem um og:title que é uma FRASE (não um
// rótulo de loja), então o casamento exato/prefixo acima não pega. Ex. real
// (Shopee, 2026-06): "Oops! Seu navegador não é mais aceito!" vazou como título
// da oferta. Estes padrões casam a frase em qualquer posição. São específicos o
// bastante para não pegar título de produto legítimo (NÃO usar "navegador"
// sozinho — existe "GPS navegador automotivo").
const BOGUS_SCRAPE_TITLE_PATTERNS = [
  /seu navegador n[ãa]o (é|e) mais (aceito|suportado)/i,
  /navegador n[ãa]o (é|e) mais (aceito|suportado)/i,
  /navegador .{0,24}(n[ãa]o suportado|desatualizado|incompat[íi]vel)/i,
  /(unsupported|outdated) browser/i,
  /your browser is no longer (supported|accepted)/i,
  /browser .{0,24}(not supported|no longer supported|not accepted)/i,
  /update your browser/i,
  /verifica[çc][ãa]o de seguran[çc]a/i,
  /security (check|verification)/i,
  /suspicious (traffic|activity)/i,
  /(verify you are|are you a) human/i,
  /acesso negado/i,
]

function isBogusScrapeTitle(title) {
  if (!title) return true
  const lower = title.trim().toLowerCase()
  if (BOGUS_SCRAPE_TITLES.some(bad => lower === bad || lower.startsWith(bad + ' |') || lower.startsWith(bad + ':'))) return true
  return BOGUS_SCRAPE_TITLE_PATTERNS.some(re => re.test(lower))
}

function extractTitleFallback(html) {
  if (!html) return ''
  for (const re of OG_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) return normalizeText(m[1])
  }
  const m = html.match(TITLE_TAG_RE)
  return m?.[1] ? normalizeText(m[1]) : ''
}

function extractTitleFromUrl(url) {
  try {
    const u = new URL(String(url || ''))
    const host = u.hostname.replace(/^www\./, '')
    if (/shopee\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)-i\.\d+\.\d+/i)
      if (m?.[1]) return normalizeText(decodeURIComponent(m[1]).replace(/-/g, ' '))
    }
    if (/amazon\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)\/dp\/[A-Z0-9]{10}/i)
      if (m?.[1]) return normalizeText(decodeURIComponent(m[1]).replace(/-/g, ' '))
    }
    if (/mercadolivre\.com\.br$/.test(host)) {
      const m = u.pathname.match(/^\/([^/]+)\/(?:up|p)\//i)
      if (m?.[1]) return normalizeText(decodeURIComponent(m[1]).replace(/-/g, ' '))
    }
  } catch {}
  return ''
}

function parseMercadoLivreProductIdFromUrl(url) {
  const m = String(url || '').match(/\/p\/(MLB[0-9]+)/i)
  return m?.[1]?.toUpperCase() || null
}

async function fetchMercadoLivreProductInfo(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  const productId = parseMercadoLivreProductIdFromUrl(url)
  if (!productId) return null
  const endpoint = `https://api.mercadolibre.com/products/${productId}`
  try {
    const appToken = await getMlAppToken()
    const headers = { 'User-Agent': BROWSER_UA, Accept: 'application/json,text/plain,*/*' }
    if (appToken) headers['Authorization'] = `Bearer ${appToken}`
    const res = await fetch(endpoint, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
    if (!res.ok) return null
    const payload = await res.json().catch(() => null)
    const name = normalizeText(payload?.name || '')
    const price = toPriceString(payload?.buy_box_winner?.price || payload?.buy_box_winner?.sale_price?.amount)
    if (!name && !price) return null
    return { title: name, oldPrice: '', newPrice: price }
  } catch {
    return null
  }
}

// 005-ml-cookie-expiry (US1): renova o access token OAuth do ML quando
// expirado, e devolve o `credentialPatch` com os tokens ROTACIONADOS (o
// refresh_token do ML é single-use — cada refresh invalida o anterior e emite
// um novo). Antes, este retorno descartava o patch e só devolvia a string do
// token; o refresh seguinte reenviava um refresh_token já invalidado e a
// sessão OAuth morria cedo. A decisão de refresh/reuso e a construção do
// patch são delegadas ao módulo puro `mlOAuthTokenPolicy.js` — quem chama
// (`fetchMercadoLivreItemInfo`) persiste o patch via `__onCredentialPatch`
// quando disponível, espelhando o padrão do eixo cookie.
// 005-ml-cookie-expiry (T030, Phase 7): o refresh_token do ML é single-use —
// duas chamadas concorrentes de scrape para a MESMA credencial (mesmo
// userId/ssid) podem cair aqui ao mesmo tempo com o MESMO refresh_token
// ainda válido; a segunda a chegar na API do ML recebe `!res.ok` porque o
// primeiro refresh já invalidou o token que ela está tentando usar. Isso não
// é fatal (o primeiro refresh persiste o token novo via `__onCredentialPatch`
// e a sessão sobrevive), mas degrada aquele scrape específico e desperdiça
// uma chamada à API do ML. Serializar sob o MESMO lock por credencial do eixo
// cookie (`withMercadoLivreCredentialLock`, `mercadolivreCredentialLock.js`)
// evita a corrida: só uma chamada de refresh por credencial em vôo por vez.
async function refreshMlOAuthToken(mlCredentials) {
  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  if (!clientId || !clientSecret) return { token: null, credentialPatch: null }
  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: mlCredentials.oauthRefreshToken,
      }).toString(),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { token: null, credentialPatch: null }
    const data = await res.json().catch(() => null)
    if (!data?.access_token) return { token: null, credentialPatch: null }
    const credentialPatch = applyOAuthTokenResponse(mlCredentials, data, Date.now())
    return { token: data.access_token, credentialPatch }
  } catch {
    return { token: null, credentialPatch: null }
  }
}

export async function getMlUserToken(mlCredentials) {
  const decision = buildOAuthRefreshDecision(mlCredentials, Date.now())
  if (decision.action === 'skip') return { token: null, credentialPatch: null }
  if (decision.action === 'reuse') return { token: decision.token, credentialPatch: null }

  try {
    return await withMercadoLivreCredentialLock(mlCredentials, () => refreshMlOAuthToken(mlCredentials))
  } catch (err) {
    // Timeout/erro do lock (ex.: `ML_AFFILIATE_LOCK_TIMEOUT`) não pode
    // quebrar o scrape em curso — mesma postura best-effort do eixo cookie.
    if (err?.code === 'ML_AFFILIATE_LOCK_TIMEOUT') return { token: null, credentialPatch: null }
    throw err
  }
}

function parseMercadoLivreItemIdFromUrl(url) {
  const m = String(url || '').match(/\/(MLB[0-9]+)/i)
  return m?.[1]?.toUpperCase() || null
}

async function fetchMercadoLivreItemInfo(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS, mlCredentials = null } = {}) {
  if (parseMercadoLivreProductIdFromUrl(url)) return null
  const itemId = parseMercadoLivreItemIdFromUrl(url)
  if (!itemId) return null
  const endpoint = `https://api.mercadolibre.com/items/${itemId}`
  try {
    const { token: userToken, credentialPatch } = await getMlUserToken(mlCredentials)
    if (credentialPatch && typeof mlCredentials?.__onCredentialPatch === 'function') {
      try {
        await mlCredentials.__onCredentialPatch('mercadolivre', credentialPatch)
      } catch (err) {
        // Best-effort: persistência do refresh OAuth rotacionado não pode
        // quebrar o fluxo de scrape em curso (mesmo padrão do eixo cookie).
      }
    }
    if (!userToken) return null
    const res = await fetch(endpoint, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json,text/plain,*/*', Authorization: `Bearer ${userToken}` },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const payload = await res.json().catch(() => null)
    const name = normalizeText(payload?.title || '')
    const price = toPriceString(payload?.price)
    if (!name && !price) return null
    return { title: name, oldPrice: '', newPrice: price }
  } catch {
    return null
  }
}


function extractAmazonPriceFromBuyBoxContext(html) {
  // Nomes de classe que o buy box usa (Amazon muda com frequência; tentamos
  // vários em ordem de confiança).
  const buyBoxRe = /(?:apexPriceToPay|priceToPay|corePriceDisplay|corePrice_desktop|apex_desktop)[\s\S]{0,800}?a-offscreen[^>]*>[^0-9]*([0-9]{1,3}(?:\.[0-9]{3})+,[0-9]{2}|[0-9]+(?:[\.,][0-9]{2})?)<\/span>/i
  const buyBoxMatch = html.match(buyBoxRe)
  if (buyBoxMatch?.[1]) return toPriceString(buyBoxMatch[1])

  // Fallback: primeiro `a-offscreen` dentro de um `a-price` span (estrutura
  // semântica que a Amazon usa para todos os preços exibidos em moeda).
  const aPriceOffscreen = html.match(/<span[^>]+class=["'][^"']*a-price[^"']*["'][^>]*>[\s\S]{0,200}?<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>[^0-9]*([0-9]{1,3}(?:\.[0-9]{3})+,[0-9]{2}|[0-9]+(?:[\.,][0-9]{2})?)<\/span>/i)
  if (aPriceOffscreen?.[1]) return toPriceString(aPriceOffscreen[1])

  return ''
}

function isAmazonUrl(url) {
  try {
    return /(^|\.)amazon\.com(\.br)?$/i.test(new URL(String(url)).hostname)
  } catch {
    return false
  }
}

// Amazon serve intermitentemente (~40% dos requests de IP de datacenter) uma
// página de CAPTCHA de ~5KB (opfcaptcha.amazon.com) em vez da PDP real de
// ~1MB. Ela traz title "Amazon.com.br", sem #productTitle, e a assinatura
// opfcaptcha/api-services-support. Detectamos para então re-tentar — cada nova
// tentativa tem ~60% de chance de devolver a página real.
function isAmazonBlockedHtml(html) {
  if (!html) return true
  if (/id=["']productTitle["']/.test(html)) return false
  return /opfcaptcha\.amazon|api-services-support@amazon|images-na\.ssl-images-amazon\.com\/captcha|Type the characters you see in this image/i.test(html)
    || html.length < 50_000
}

function extractAmazonTitleAndPrice(html) {
  const titleMatch = html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)
  const title = titleMatch?.[1] ? normalizeText(titleMatch[1]) : ''

  const buyBoxPrice = extractAmazonPriceFromBuyBoxContext(html)
  if (buyBoxPrice) return { title, newPrice: buyBoxPrice }

  const offscreenPrice = html.match(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>[^0-9]*([0-9]{1,3}(?:\.[0-9]{3})+,[0-9]{2}|[0-9]+(?:[\.,][0-9]{2})?)<\/span>/i)
  const whole = html.match(/<span[^>]+class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9\.]+)<\/span>/i)?.[1]
  const fraction = html.match(/<span[^>]+class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{2})<\/span>/i)?.[1]
  const inlinePrice = whole && fraction ? `${whole},${fraction}` : ''
  const newPrice = offscreenPrice?.[1] ? toPriceString(offscreenPrice[1]) : toPriceString(inlinePrice)
  return { title, newPrice }
}


// Parsing de IDs e resolução de short link delegados ao módulo shopee.js —
// extractShopeeIds cobre IDs no path E URL-encoded em query param (anti-bot
// verify/traffic?next=...); resolveShopeeShortLink segue redirects manualmente
// com cookies e para no primeiro hop que já contém os IDs.
function parseShopeeIdsFromUrl(url) {
  return extractShopeeIds(url)
}

async function resolveShopeeUrl(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  return resolveShopeeShortLink(String(url || ''), { timeoutMs })
}

function shopeePriceIntToString(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return toPriceString(num / 100000)
}

function firstPositiveShopeePrice(...values) {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num) && num > 0) return value
  }
  return null
}

function extractShopeeModelPrices(item) {
  const models = Array.isArray(item?.models) ? item.models : []
  let minCurrent = null
  let maxOld = null
  for (const model of models) {
    const current = Number(firstPositiveShopeePrice(model?.price, model?.price_stocks?.[0]?.price, model?.price_info?.price))
    const old = Number(firstPositiveShopeePrice(model?.price_before_discount, model?.price_info?.price_before_discount))
    if (Number.isFinite(current) && current > 0) {
      minCurrent = minCurrent == null ? current : Math.min(minCurrent, current)
    }
    if (Number.isFinite(old) && old > 0) {
      maxOld = maxOld == null ? old : Math.max(maxOld, old)
    }
  }
  return { minCurrent, maxOld }
}

function extractShopeePriceFromHtml(html) {
  if (!html) return ''
  const ptBr = html.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/)
  if (ptBr?.[1]) return toPriceString(ptBr[1])
  const jsonDecimal = html.match(/"(?:price|current_price)"\s*:\s*"?([0-9]+\.[0-9]{2})"?/) || html.match(/"(?:price|current_price)"\s*:\s*([0-9]+\.[0-9]{2})/)
  if (jsonDecimal?.[1]) return toPriceString(jsonDecimal[1])
  return ''
}

function extractShopeePriceRangeFromHtml(html) {
  if (!html) return null
  const matches = [...html.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)]
  if (!matches.length) return null
  const values = matches
    .map((m) => String(m[1] || '').trim())
    .map((v) => Number.parseFloat(v.replace(/\./g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  if (min === max) return { oldPrice: '', newPrice: toPriceString(min) }
  return { oldPrice: toPriceString(max), newPrice: toPriceString(min) }
}

function extractShopeePriceRangeFromJsonInHtml(html) {
  if (!html) return null

  const minMatch = html.match(/"price_min"\s*:\s*(\d{4,})/)
  const oldMatch = html.match(/"price_before_discount"\s*:\s*(\d{4,})/)
  const maxOldMatch = html.match(/"price_max_before_discount"\s*:\s*(\d{4,})/)
  const fallbackPriceMatch = html.match(/"price"\s*:\s*(\d{4,})/)

  const currentRaw = firstPositiveShopeePrice(minMatch?.[1], fallbackPriceMatch?.[1])
  const oldRaw = firstPositiveShopeePrice(oldMatch?.[1], maxOldMatch?.[1])

  const newPrice = shopeePriceIntToString(currentRaw)
  const oldPrice = shopeePriceIntToString(oldRaw)
  if (newPrice || oldPrice) return { newPrice, oldPrice }
  return null
}

async function fetchShopeeItemInfo(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS, shopeeCreds = null } = {}) {
  if (shopeeCreds?.appId) {
    const affiliateResult = await fetchShopeeProductInfo(url, shopeeCreds)
    if (affiliateResult) return affiliateResult
  }

  const canonical = await resolveShopeeUrl(url, { timeoutMs })
  const ids = parseShopeeIdsFromUrl(canonical)
  if (!ids) return null
  const endpoint = `https://shopee.com.br/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`
  // Shopee v4 API exige csrf token para não retornar error 90309999.
  // SPC_F é o fingerprint de sessão anônima; csrftoken deve corresponder.
  const spcToken = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  try {
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json,text/plain,*/*',
        Referer: `https://shopee.com.br/product/${ids.shopId}/${ids.itemId}`,
        Cookie: `SPC_F=${spcToken}; csrftoken=${spcToken}`,
        'x-csrftoken': spcToken,
        'x-api-source': 'pc',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const payload = await res.json().catch(() => null)
    const item = payload?.data?.item
    if (!item) return null

    const modelPrices = extractShopeeModelPrices(item)
    const oldRaw = firstPositiveShopeePrice(item.price_before_discount, item.price_max_before_discount, item.price_min_before_discount, modelPrices.maxOld)
    const currentRaw = firstPositiveShopeePrice(item.price_min, item.price, item.price_max, modelPrices.minCurrent)

    return {
      title: normalizeText(item.name || ''),
      oldPrice: shopeePriceIntToString(oldRaw),
      newPrice: shopeePriceIntToString(currentRaw),
    }
  } catch {
    return null
  }
}

// Converte um bloco DOM `andes-money-amount` (fração + centavos) do Mercado
// Livre para string "39,90". A fração pode trazer milhar com ponto (1.299).
function parseAndesAmount(segment) {
  if (!segment) return ''
  const fraction = segment.match(/andes-money-amount__fraction[^>]*>\s*([0-9.]+)\s*</i)?.[1]
  if (!fraction) return ''
  const cents = segment.match(/andes-money-amount__cents[^>]*>\s*([0-9]{2})\s*</i)?.[1]
  const whole = fraction.replace(/\./g, '')
  return cents ? `${whole},${cents}` : `${whole},00`
}

// Extrai título e preços direto do HTML da página de produto (PDP) do Mercado
// Livre. Usado como caminho principal desde que a API pública
// (api.mercadolibre.com/products) passou a exigir autenticação e responder 401.
// Cobre tanto o DOM renderizado (`ui-pdp-title`, `andes-money-amount`) quanto o
// JSON embarcado (`"price":{"value":..,"original_value":..}`).
function extractMercadoLivreFromHtml(html) {
  if (!html) return null
  if (!/mercadolivre|mercadolibre|ui-pdp-/i.test(html)) return null

  let title = ''
  for (const re of OG_TITLE_RE) {
    const m = html.match(re)
    if (m?.[1]) { title = normalizeText(m[1]); break }
  }
  if (!title) {
    const h1 = html.match(/<h1[^>]+class=["'][^"']*ui-pdp-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    if (h1?.[1]) title = normalizeText(h1[1].replace(/<[^>]+>/g, ' '))
  }

  // Preço "de" (riscado) vem num <s class="... ui-pdp-price__original-value ...">.
  let oldPrice = ''
  const originalBlock = html.match(/ui-pdp-price__original-value[\s\S]{0,400}?<\/s>/i)
  if (originalBlock) oldPrice = parseAndesAmount(originalBlock[0])

  // Preço atual: primeiro andes-money-amount dentro do bloco principal de preço.
  let newPrice = ''
  const currentBlock = html.match(/ui-pdp-price__second-line[\s\S]{0,600}?<\/div>/i)
  if (currentBlock) newPrice = parseAndesAmount(currentBlock[0])

  // Fallback via JSON embarcado no HTML (__PRELOADED_STATE__ etc.).
  if (!newPrice) {
    const m = html.match(/"price"\s*:\s*\{[^{}]*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (m?.[1]) newPrice = toPriceString(m[1])
  }
  if (!oldPrice) {
    const m = html.match(/"original_price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
      || html.match(/"original_value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (m?.[1]) oldPrice = toPriceString(m[1])
  }

  if (!title && !newPrice && !oldPrice) return null
  return { title, oldPrice, newPrice }
}

function extractMetaPrice(html) {
  if (!html) return ''
  for (const re of META_PRICE_RE) {
    const m = html.match(re)
    if (m?.[1]) return toPriceString(m[1])
  }
  return ''
}

// Landings sociais do Mercado Livre (meli.la, mluvem.com, /social/...) embedam
// o produto destacado num JSON inline com a estrutura:
//   "price":{"previous_price":{"value":599.99,...},"current_price":{"value":399.99,...}}
// A primeira ocorrência é o produto que a share aponta — pegamos esses dois
// valores diretamente, já que /produto/MLB* normal cai em anti-bot.
function extractFromMercadoLivreLanding(html) {
  const block = html.match(/"price"\s*:\s*\{[^{}]*"previous_price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)[^{}]*\}[^{}]*"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)
  if (block) {
    return { oldPrice: toPriceString(block[1]), newPrice: toPriceString(block[2]) }
  }
  // Em ofertas sem desconto, só vem current_price — devolvemos só o novo.
  const single = html.match(/"current_price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)
  if (single) {
    return { oldPrice: '', newPrice: toPriceString(single[1]) }
  }
  return null
}

function isMercadoLivreLandingUrl(url) {
  try {
    const u = new URL(String(url || ''))
    if (/meli\.la|mluvem\.com/.test(u.hostname)) return true
    if (/\/social\//i.test(u.pathname)) return true
    // Links de recomendação /up/MLBU... (mercadolivre.com.br/.../up/MLBU...)
    // não são página de produto: o MLB real vem em `wid=MLB...` no fragmento.
    // resolveToCleanProductUrl extrai o MLB e gera a URL canônica do produto;
    // sem isso o scrape do /up/ cru cai na página de recomendação (sem
    // og:title/preço do produto) ou no anti-bot. Cobre o caso em que o link
    // chega aqui SEM passar pela conversão (ex.: usuário sem credenciais ML).
    if (/mercadoli(?:vre|bre)/i.test(u.hostname) && /(?:^|\/)up\//i.test(u.pathname)) return true
    return false
  } catch {
    return false
  }
}

// Expande um short link do ML (meli.la, mluvem.com) seguindo o(s) redirect(s)
// manualmente para PRESERVAR a query string — em especial o parâmetro `ref` das
// shares /social/, que é o que identifica QUAL produto a share representa. Um
// fetch com redirect:follow anônimo descartaria o produto destacado e cairia na
// vitrine genérica /social/<tag>/lists. Retorna a URL expandida ou a original.
async function expandMlShortLink(url, { timeoutMs = HTML_FETCH_TIMEOUT_MS } = {}) {
  let current = String(url || '')
  for (let i = 0; i < 5; i++) {
    let host
    try { host = new URL(current).hostname } catch { break }
    if (!/(?:^|\.)(?:meli\.la|mluvem\.com)$/i.test(host)) break
    try {
      const res = await fetch(current, {
        headers: { 'User-Agent': BROWSER_UA },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      })
      const loc = res.headers.get('location')
      if (!loc) {
        // Sem redirect: usa a URL final que o fetch reportar (se houver).
        return res.url || current
      }
      current = loc.startsWith('http') ? loc : new URL(loc, current).href
    } catch {
      break
    }
  }
  return current
}

// Uma URL /social/ do ML com ?ref= é uma share de UM produto destacado (o `ref`
// identifica o produto dentro da vitrine do afiliado). Raspada autenticada (com
// cookie ssid) o ML serve a visão do produto compartilhado, de onde og:title e o
// primeiro bloco de preço (previous_price/current_price) são o produto certo.
function isMercadoLivreSocialShare(url) {
  try {
    const u = new URL(String(url || ''))
    return /mercadoli(?:vre|bre)/i.test(u.hostname) && /^\/social\//i.test(u.pathname)
  } catch {
    return false
  }
}

export async function fetchProductInfo(url, opts = {}) {
  // Para URLs do ML, usa a sessão autenticada do usuário (cookie ssid) e o UA
  // mobile: sem isso o ML responde com a página anti-bot /gz/account-verification
  // (title "Mercado Libre", sem og:title nem preço) e nada é extraído.
  const mlCookieHeader = opts.mlCookieHeader || buildMlCookieHeader(opts.mlCredentials)
  const shopeeCreds = opts.shopeeCreds || opts.shopeeCredentials || null
  const fetchOpts = { ...opts }

  // Resolução de landing do ML. Dois caminhos:
  //   (1) Share /social/?ref= COM cookie → NÃO canonicalizar. O `ref` identifica
  //       o produto destacado; raspamos a própria URL /social/ autenticada e os
  //       extratores (og:title + previous/current_price) pegam o produto certo.
  //       Canonicalizar aqui jogava fora o `ref` e resolveToCleanProductUrl caía
  //       no anti-bot (IP datacenter) extraindo um MLB aleatório/errado.
  //   (2) Demais landings (/up/, meli.la → /p/MLB, sem cookie) → mantém o
  //       resolveToCleanProductUrl histórico (best-effort).
  let resolvedUrl = url
  if (isMercadoLivreLandingUrl(url)) {
    const expanded = await expandMlShortLink(url).catch(() => url)
    if (mlCookieHeader && isMercadoLivreSocialShare(expanded)) {
      resolvedUrl = expanded
    } else {
      const canonical = await resolveToCleanProductUrl(url).catch(() => null)
      if (canonical) resolvedUrl = canonical
    }
  } else if (isShopeeShortLink(url)) {
    // Pré-resolve o short link da Shopee ANTES do fetch de HTML: assim o
    // título via slug (extractTitleFromUrl) e as APIs (afiliado/v4) recebem a
    // URL do produto mesmo quando o fetch follow do short link terminaria numa
    // página anti-bot sem os IDs.
    resolvedUrl = await resolveShopeeShortLink(url, { timeoutMs: HTML_FETCH_TIMEOUT_MS })
  } else if (isAmazonShortLink(url)) {
    // Pré-resolve short link da Amazon (amzn.la, amzn.to, a.co...) ANTES do
    // fetch de HTML. amzn.la pode servir interstitial (redirect via JS/meta)
    // que o fetch(redirect:follow) não atravessa, deixando o scrape na página
    // de redirect sem og:title/preço. O resolvedor robusto chega na PDP real.
    resolvedUrl = await resolveAmazonShortLink(url, { timeoutMs: HTML_FETCH_TIMEOUT_MS })
  }

  // Cookie/UA mobile são checados sobre a URL JÁ resolvida: meli.la/mluvem.com
  // não casam isMercadoLivreUrl, mas a canônica produto.mercadolivre.com.br
  // sim — sem isso o fetch da resolvida cai no anti-bot /gz/account-verification.
  if (mlCookieHeader && isMercadoLivreUrl(resolvedUrl)) {
    fetchOpts.cookieHeader = mlCookieHeader
    fetchOpts.ua = opts.ua || ML_MOBILE_UA
  }

  let html = null
  let finalUrl = resolvedUrl
  try {
    const fetched = await fetchHtml(resolvedUrl, fetchOpts)
    html = fetched?.html ?? null
    finalUrl = fetched?.finalUrl || resolvedUrl
  } catch {
    html = null
    finalUrl = resolvedUrl
  }

  // Retry do CAPTCHA do Amazon: quando o request cai na página de bloqueio
  // (opfcaptcha, ~5KB, sem #productTitle), refaz a busca — cada tentativa tem
  // ~60% de pegar a PDP real, então até 4 retries levam a taxa de sucesso de
  // ~60% para ~99%. Só dispara para URLs Amazon que voltaram bloqueadas.
  if ((isAmazonUrl(resolvedUrl) || isAmazonUrl(finalUrl)) && isAmazonBlockedHtml(html)) {
    for (let attempt = 0; attempt < AMAZON_CAPTCHA_MAX_RETRIES && isAmazonBlockedHtml(html); attempt++) {
      await new Promise(resolve => setTimeout(resolve, AMAZON_CAPTCHA_RETRY_DELAY_MS))
      try {
        const retried = await fetchHtml(finalUrl || resolvedUrl, fetchOpts)
        if (retried?.html) {
          html = retried.html
          finalUrl = retried.finalUrl || finalUrl
        }
      } catch {
        // mantém o html anterior; próxima iteração tenta de novo
      }
    }
  }

  // Amazon CAPTCHA esgotado: um último retry com facebookexternalhit. A Amazon
  // às vezes serve HTML diferente para UAs de crawler conhecidos — se retornar
  // HTML de produto real, usa. Só dispara se todos os retries normais ainda
  // devolveram CAPTCHA.
  if ((isAmazonUrl(resolvedUrl) || isAmazonUrl(finalUrl)) && isAmazonBlockedHtml(html)) {
    try {
      const crawlerResult = await fetchHtml(finalUrl || resolvedUrl, {
        ua: ML_CRAWLER_UA,
        timeoutMs: HTML_FETCH_TIMEOUT_MS,
      })
      if (crawlerResult?.html && !isAmazonBlockedHtml(crawlerResult.html)) {
        html = crawlerResult.html
        finalUrl = crawlerResult.finalUrl || finalUrl
      }
    } catch {
      // mantém html anterior
    }
  }

  // Shopee sem creds: o shell SPA não tem título/preço e a API v4 anônima é
  // instável. Tenta UAs de crawler (whitelisted pela Shopee para preview de
  // link) que recebem HTML SSR com og:title e JSON-LD de preço. NÃO dispara
  // quando há credenciais de afiliado — esse caminho já é coberto pela API.
  if (!shopeeCreds && extractShopeeIds(resolvedUrl || url) && isShopeeSpaShell(html)) {
    const ssrResult = await fetchShopeeSSRHtml(resolvedUrl || url, { timeoutMs: HTML_FETCH_TIMEOUT_MS })
    if (ssrResult?.html) {
      html = ssrResult.html
      finalUrl = ssrResult.finalUrl || finalUrl
    }
  }

  // Bug: links curtos do ML (meli.la, mluvem.com) redirecionam para
  // mercadolivre.com.br, mas o fetch() descarta o cabeçalho Cookie em
  // redirects cross-domain (undici/browser — segurança contra CSRF). Dois
  // cenários surgem:
  //   a) html=null  → ML retornou 403 sem autenticação
  //   b) html=antibot → ML retornou 200 com /gz/account-verification (sem ssid)
  //
  // Solução: se chegamos a uma URL ML (redirect funcionou), temos credenciais
  // mas não as aplicamos na requisição inicial (URL de origem não era ML) →
  // refaz diretamente na URL ML com cookie + UA mobile.
  const needsMlCookieRetry = mlCookieHeader && !fetchOpts.cookieHeader && isMercadoLivreUrl(finalUrl)
  if (needsMlCookieRetry) {
    const noUsefulMlHtml = !html
      || (html.length < 50_000 && !html.includes('ui-pdp') && !html.includes('andes-money-amount'))
    if (noUsefulMlHtml) {
      try {
        const retried = await fetchHtml(finalUrl, { ...fetchOpts, cookieHeader: mlCookieHeader, ua: ML_MOBILE_UA })
        if (retried?.html) {
          html = retried.html
          finalUrl = retried.finalUrl || finalUrl
        }
      } catch {}
    }
  }

  // ML sem creds: quando o HTML parece anti-bot e não há cookie ssid, tenta
  // uma vez com UA de crawler — ML o whitelist para preview de links e pode
  // servir HTML com og:title e preços. Só dispara sem credenciais (com creds
  // o bloco needsMlCookieRetry acima já cobre).
  if (!mlCookieHeader && isMercadoLivreUrl(finalUrl) && isMercadoLivreAntiBotHtml(html)) {
    try {
      const crawlerResult = await fetchHtml(finalUrl, { ua: ML_CRAWLER_UA, timeoutMs: HTML_FETCH_TIMEOUT_MS })
      if (crawlerResult?.html && !isMercadoLivreAntiBotHtml(crawlerResult.html)) {
        html = crawlerResult.html
        finalUrl = crawlerResult.finalUrl || finalUrl
      }
    } catch {
      // mantém html anterior
    }
  }

  const jsonLd = html ? extractFromJsonLd(html) : null
  const mlHtml = html ? extractMercadoLivreFromHtml(html) : null
  const mlLanding = html ? extractFromMercadoLivreLanding(html) : null
  const amazonFallback = html ? extractAmazonTitleAndPrice(html) : null
  // Para a API da Shopee, prioriza a URL que de fato contém (shopId, itemId):
  // o fetch de HTML pode ter redirecionado para uma página anti-bot (finalUrl
  // sem IDs) enquanto resolvedUrl preserva a URL do produto.
  const shopeeApiSourceUrl = [finalUrl, resolvedUrl, url].find((candidate) => extractShopeeIds(candidate)) || finalUrl || url
  const shopeeApiFallback = await fetchShopeeItemInfo(shopeeApiSourceUrl, { ...opts, shopeeCreds })
  const shopeeHtmlRange = extractShopeePriceRangeFromHtml(html)
  const shopeeJsonRange = extractShopeePriceRangeFromJsonInHtml(html)

  // ML Products API como último recurso: só chamar se não temos título E preço
  // do HTML (a API requer autenticação OAuth em acessos de IP de datacenter,
  // chamá-la quando o HTML já deu o suficiente desperdiça até 8s por oferta).
  const hasHtmlTitleAndPrice = !!(
    (jsonLd?.title && jsonLd?.newPrice) || (mlHtml?.title && mlHtml?.newPrice)
  )
  const mercadoLivreApiFallback = hasHtmlTitleAndPrice
    ? null
    : await fetchMercadoLivreProductInfo(finalUrl || url, opts)
  const mlItemApiFallback = (hasHtmlTitleAndPrice || mercadoLivreApiFallback)
    ? null
    : await fetchMercadoLivreItemInfo(finalUrl || url, opts)

  const titleFromUrl = extractTitleFromUrl(finalUrl || url) || extractTitleFromUrl(resolvedUrl) || extractTitleFromUrl(url)
  const rawFallbackTitle = extractTitleFallback(html)
  const fallbackTitle = isBogusScrapeTitle(rawFallbackTitle) ? null : rawFallbackTitle
  // Mesmo og:title vindo de extractMercadoLivreFromHtml pode ser o título
  // genérico da página anti-bot ("Mercado Libre"/"Shopee"/"Amazon.com.br").
  // Filtra o título final por isBogusScrapeTitle para nunca apresentar um
  // rótulo de loja como nome de produto (vazaria na oferta espelhada).
  const rawTitle = jsonLd?.title || mlHtml?.title || amazonFallback?.title || shopeeApiFallback?.title || mercadoLivreApiFallback?.title || mlItemApiFallback?.title || titleFromUrl || fallbackTitle
  const title = isBogusScrapeTitle(rawTitle) ? '' : rawTitle

  // Numa share /social/ a página tem VÁRIOS produtos; extractMercadoLivreFromHtml
  // pode casar o `"price":{"value":..}` de um produto vizinho (errado). O bloco
  // previous_price/current_price extraído por extractFromMercadoLivreLanding é o
  // do produto destacado pelo `ref` — então para social share ele tem prioridade
  // sobre mlHtml no preço.
  const socialShare = isMercadoLivreSocialShare(finalUrl) || isMercadoLivreSocialShare(resolvedUrl)
  const mlPrimaryNew = socialShare ? (mlLanding?.newPrice || mlHtml?.newPrice) : (mlHtml?.newPrice || mlLanding?.newPrice)
  const mlPrimaryOld = socialShare ? (mlLanding?.oldPrice || mlHtml?.oldPrice) : (mlHtml?.oldPrice || mlLanding?.oldPrice)

  const newPrice = jsonLd?.newPrice || mlPrimaryNew || amazonFallback?.newPrice || shopeeApiFallback?.newPrice || shopeeJsonRange?.newPrice || shopeeHtmlRange?.newPrice || mercadoLivreApiFallback?.newPrice || mlItemApiFallback?.newPrice || extractMetaPrice(html) || extractShopeePriceFromHtml(html)
  const oldPrice = jsonLd?.oldPrice || mlPrimaryOld || shopeeApiFallback?.oldPrice || shopeeJsonRange?.oldPrice || shopeeHtmlRange?.oldPrice || mercadoLivreApiFallback?.oldPrice || mlItemApiFallback?.oldPrice || ''
  return { title, oldPrice, newPrice, finalUrl }
}
