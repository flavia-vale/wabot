import sharp from 'sharp'

const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
]

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const TWITTER_IMAGE_RE = [
  /<meta[^>]+(?:name|property)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']twitter:image(?::src)?["']/i,
]
const AMAZON_DYNAMIC_IMAGE_RE = /data-a-dynamic-image=["']([^"']+)["']/i
const AMAZON_INLINE_IMAGE_RE = /\"(?:hiRes|large)\"\s*:\s*\"(https?:\\\/\\\/[^\"]+)\"/gi
const AMAZON_ATTR_IMAGE_RE = /(?:data-old-hires|data-a-hires|src)=['"](https?:\/\/[^'"]*media-amazon\.com[^'"]+)['"]/gi
const AMAZON_MEDIA_HOST_RE = /(^|\.)media-amazon\.com$|(^|\.)ssl-images-amazon\.com$/
// Imagens reais de produto da Amazon ficam em /images/I/. Já /images/G/ é
// usado para logos, banners, ícones de navegação e placeholders — quando a
// página vem degradada (captcha, A/B mobile), og:image cai nesse caminho e
// resulta em "imagem branca" no WhatsApp.
const AMAZON_PRODUCT_IMAGE_PATH_RE = /\/images\/I\//i
const AMAZON_NON_PRODUCT_HINT_RE = /amazonlogo|nav-logo|sprite|transparent-pixel|grey-pixel|loading|\/images\/G\//i
const AMAZON_ASIN_RE = /(?:\/dp\/|\/gp\/product\/|\/product-reviews\/|\/exec\/obidos\/ASIN\/)([A-Z0-9]{10})/i
const SHOPEE_IMAGE_HOST_RE = /(^|\.)susercontent\.com$|^cf\.shopee\.com\.br$/
const IMAGE_CACHE_TTL_MS = 5 * 60 * 1000
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS) || 2_500
// Amazon e Shopee podem demorar 3-5s para responder — timeout separado
// para não cortar o HTML antes de chegarmos ao og:image do produto.
const IMAGE_HTML_FETCH_TIMEOUT_MS = Number(process.env.IMAGE_HTML_FETCH_TIMEOUT_MS) || 7_000
const IMAGE_HTML_MAX_BYTES = Number(process.env.IMAGE_HTML_MAX_BYTES) || 512 * 1024
const IMAGE_BUFFER_TIMEOUT_MS = Number(process.env.IMAGE_BUFFER_TIMEOUT_MS) || 5_000
const IMAGE_BUFFER_MAX_BYTES = Number(process.env.IMAGE_BUFFER_MAX_BYTES) || 5 * 1024 * 1024
const IMAGE_MIN_DIMENSION_PX = Number(process.env.IMAGE_MIN_DIMENSION_PX) || 120

// User-Agent de browser real: Shopee e outros sites bloqueiam UAs de bot e
// devolvem HTML sem og:image, causando "sem imagem" nos anúncios.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const imageCache = new Map()
const domainFailureMetrics = new Map()

function getDomain(url) {
  try { return new URL(url).hostname } catch { return 'invalid-url' }
}

function incFailure(url) {
  const domain = getDomain(url)
  domainFailureMetrics.set(domain, (domainFailureMetrics.get(domain) ?? 0) + 1)
}

function getCached(url) {
  const cached = imageCache.get(url)
  if (!cached) return null
  if (cached.expiresAt < Date.now()) {
    imageCache.delete(url)
    return null
  }
  return cached.value
}

function setCached(url, value) {
  imageCache.set(url, { value, expiresAt: Date.now() + IMAGE_CACHE_TTL_MS })
}

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeHtmlImageUrl(value) {
  if (!value) return null
  return decodeHtmlEntities(value).replace(/\\\//g, '/').trim() || null
}

function extractJsonLdImage(html) {
  const scripts = [...html.matchAll(JSON_LD_RE)]
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1])
      const nodes = Array.isArray(parsed) ? parsed : [parsed]
      for (const node of nodes) {
        const image = node?.image
        if (typeof image === 'string') return normalizeHtmlImageUrl(image)
        if (Array.isArray(image) && typeof image[0] === 'string') return normalizeHtmlImageUrl(image[0])
        if (image?.url) return normalizeHtmlImageUrl(image.url)
      }
    } catch {
      // ignora json-ld inválido
    }
  }
  return null
}

async function readLimitedText(res) {
  const contentLength = Number(res.headers.get('content-length'))
  if (contentLength && contentLength > IMAGE_HTML_MAX_BYTES) return null
  if (!res.body) return res.text()

  const reader = res.body.getReader()
  const chunks = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > IMAGE_HTML_MAX_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

async function fetchHtml(url, { ua = 'Mozilla/5.0 (compatible; BotConversorAfiliados/1.0)', timeoutMs = IMAGE_HTML_FETCH_TIMEOUT_MS } = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  })
  if (!res.ok) return { html: null, finalUrl: url }
  const contentType = res.headers.get('content-type') || ''
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return { html: null, finalUrl: res.url || url }
  }
  const html = await readLimitedText(res)
  return { html, finalUrl: res.url || url }
}

function extractImageFromHtmlLayers(html) {
  if (!html) return null

  for (const re of OG_IMAGE_RE) {
    const m = html.match(re)
    if (m?.[1]) return normalizeHtmlImageUrl(m[1])
  }

  for (const re of TWITTER_IMAGE_RE) {
    const m = html.match(re)
    if (m?.[1]) return normalizeHtmlImageUrl(m[1])
  }

  return extractJsonLdImage(html)
}

async function resolveByHtmlLayers(url, opts) {
  const { html } = await fetchHtml(url, opts)
  return extractImageFromHtmlLayers(html)
}

const AMAZON_SHORT_HOST_RE = /^(amzn\.to|a\.co|amzn\.divulgador\.link)$/

async function resolveAmazonShortLink(url) {
  try {
    const u = new URL(url)
    if (!AMAZON_SHORT_HOST_RE.test(u.hostname)) return url
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    return res.url || url
  } catch { return url }
}

function pickLargestAmazonDynamicImage(raw) {
  try {
    const parsed = JSON.parse(decodeHtmlEntities(raw))
    let best = null
    for (const [imageUrl, dimensions] of Object.entries(parsed)) {
      const width = Number(dimensions?.[0]) || 0
      const height = Number(dimensions?.[1]) || 0
      const score = width * height
      if (!best || score > best.score) best = { url: imageUrl, score }
    }
    return normalizeHtmlImageUrl(best?.url)
  } catch {
    return null
  }
}

function isAmazonProductImage(rawUrl) {
  if (!rawUrl) return false
  if (AMAZON_NON_PRODUCT_HINT_RE.test(rawUrl)) return false
  try {
    const u = new URL(rawUrl)
    if (!AMAZON_MEDIA_HOST_RE.test(u.hostname)) return false
    return AMAZON_PRODUCT_IMAGE_PATH_RE.test(u.pathname)
  } catch {
    return false
  }
}

function extractAmazonImageFromHtml(html) {
  const candidates = []
  const dynamic = html.match(AMAZON_DYNAMIC_IMAGE_RE)
  const dynamicImage = dynamic?.[1] ? pickLargestAmazonDynamicImage(dynamic[1]) : null
  if (dynamicImage) candidates.push(dynamicImage)

  for (const match of html.matchAll(AMAZON_INLINE_IMAGE_RE)) {
    const image = normalizeHtmlImageUrl(match[1])
    if (image) candidates.push(image)
  }

  for (const match of html.matchAll(AMAZON_ATTR_IMAGE_RE)) {
    const image = normalizeHtmlImageUrl(match[1])
    if (image) candidates.push(image)
  }

  // Mantém só URLs de produto (/images/I/). og:image em página degradada
  // (bot detection, mobile redirect) costuma cair em /images/G/ (logo/banner)
  // e gerar miniatura branca no link preview do WhatsApp.
  return uniqueImageUrls(candidates).find(isAmazonProductImage) || null
}

function extractAsinFromUrl(rawUrl) {
  if (!rawUrl) return null
  const m = String(rawUrl).match(AMAZON_ASIN_RE)
  return m ? m[1].toUpperCase() : null
}

// Fetcha o HTML do widget de imagem da Amazon via adsystem — endpoint
// público que NÃO exige auth, funciona para qualquer ASIN (eletrônicos,
// roupas, etc.) e devolve um img tag com a URL real do produto.
// Mais confiável que /images/P/ (só funciona para livros).
async function resolveAmazonImageFromWidget(asin) {
  if (!asin) return null
  try {
    const widgetUrl = `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL500_&ID=AsinImage&MarketPlace=BR&ServiceVersion=20070822&WS=1`
    const { html } = await fetchHtml(widgetUrl, { ua: BROWSER_UA, timeoutMs: IMAGE_FETCH_TIMEOUT_MS * 2 })
    if (!html) return null
    const m = html.match(/src=["'](https?:\/\/[^"']*\/images\/I\/[^"']+)["']/i)
    const imgUrl = m ? normalizeHtmlImageUrl(m[1]) : null
    return isAmazonProductImage(imgUrl) ? imgUrl : null
  } catch {
    return null
  }
}

async function resolveAmazonImage(url) {
  const target = await resolveAmazonShortLink(url)
  const asin = extractAsinFromUrl(target) || extractAsinFromUrl(url)

  for (const opts of [{ ua: BROWSER_UA }, { ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }]) {
    try {
      const { html } = await fetchHtml(target, opts)
      if (!html) continue
      const amazonImage = extractAmazonImageFromHtml(html)
      if (amazonImage) return amazonImage
      const layered = extractImageFromHtmlLayers(html)
      if (isAmazonProductImage(layered)) return layered
    } catch {
      // tenta o próximo UA/fallback
    }
  }

  return resolveAmazonImageFromWidget(asin)
}

function isAmazonImageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    return AMAZON_MEDIA_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

function isShopeeImageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    return SHOPEE_IMAGE_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}


// Extrai (shopid, itemid) de URLs Shopee no formato:
//   https://shopee.com.br/produto-i.{shopid}.{itemid}
//   https://shopee.com.br/product/{shopid}/{itemid}
function parseShopeeIds(url) {
  try {
    const u = new URL(url)
    if (!/shopee\.com\.br$/.test(u.hostname)) return null
    const m1 = u.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/)
    if (m1) return { shopid: m1[1], itemid: m1[2] }
    const m2 = u.pathname.match(/^\/product\/(\d+)\/(\d+)(?:\/|$)/)
    if (m2) return { shopid: m2[1], itemid: m2[2] }
    return null
  } catch { return null }
}

// Resolve short links da Shopee (shope.ee, s.shopee.com.br) para a URL canônica.
async function resolveShopeeShortLink(url) {
  try {
    const u = new URL(url)
    if (!/^(shope\.ee|s\.shopee\.com\.br)$/.test(u.hostname)) return url
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
    return res.url || url
  } catch { return url }
}

function shopeeImageUrl(hash) {
  if (!hash) return null
  if (/^https?:\/\//i.test(hash)) return hash
  return `https://down-br.img.susercontent.com/file/${hash}`
}

// User-Agents que a Shopee atende com SSR (renderizando og:image no HTML).
// O SPA não embute og:image para UAs comuns, então UA de browser ou bot retorna
// página vazia. facebookexternalhit/WhatsApp são whitelisted pela Shopee.
const SHOPEE_CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.24.10.85 A',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

async function resolveShopeeImage(url, creds) {
  // 1) Caminho preferencial: API de afiliado (GraphQL) — usa creds que já temos.
  if (creds?.shopee?.appId && creds?.shopee?.secretKey) {
    try {
      const { fetchShopeeImage } = await import('./shopee.js')
      const img = await fetchShopeeImage(url, creds.shopee)
      if (img) return img
    } catch {
      // segue para fallbacks
    }
  }

  const canonical = await resolveShopeeShortLink(url)

  for (const ua of SHOPEE_CRAWLER_UAS) {
    const img = await resolveByHtmlLayers(canonical, { ua }).catch(() => null)
    if (img) return img
  }

  // Fallback: API v4 de itens (público) — pode ser bloqueado por anti-bot,
  // mas tentamos antes de desistir.
  const ids = parseShopeeIds(canonical)
  if (ids) {
    try {
      const apiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${ids.itemid}&shopid=${ids.shopid}`
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'application/json',
          'Referer': canonical,
          'X-API-SOURCE': 'pc',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      })
      if (res.ok) {
        const json = await res.json()
        const item = json?.data || json?.item
        const hash = item?.image || item?.images?.[0]
        const built = shopeeImageUrl(hash)
        if (built) return built
      }
    } catch {
      // segue para retorno nulo
    }
  }
  return null
}

export function getImageResolverMetrics() {
  return Object.fromEntries(domainFailureMetrics)
}

export async function fetchProductImage(platform, productUrl, creds) {
  const cached = getCached(productUrl)
  if (cached !== null) return cached

  try {
    let image = null
    if (platform === 'shopee') {
      image = await resolveShopeeImage(productUrl, creds)
    } else if (platform === 'amazon') {
      image = await resolveAmazonImage(productUrl)
    }
    if (!image) image = await resolveByHtmlLayers(productUrl, { ua: BROWSER_UA })

    if (!image) incFailure(productUrl)
    setCached(productUrl, image)
    return image
  } catch {
    incFailure(productUrl)
    setCached(productUrl, null)
    return null
  }
}

// Re-encoda a imagem como JPEG e gera um thumbnail JPEG leve.
// Necessário porque a Baileys chama sharp.metadata() para gerar thumbnail
// automaticamente; quando os bytes vêm em formato não suportado pelo sharp
// (HEIC sem libheif, AVIF, ou bytes corrompidos), o sharp falha e a imagem
// chega quebrada no WhatsApp. Pré-gerando o thumbnail aqui, a Baileys pula
// sua chamada interna ao sharp (messages.js:132).
export async function normalizeImageForWhatsApp(buf) {
  if (!buf?.length) return null
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata()
    if (!meta?.width || !meta?.height) return null

    // Converte para JPEG; redimensiona se for absurdamente grande.
    // Resolução/qualidade calibradas para o WA: WhatsApp recomprime na
    // própria infra, então enviar com qualidade folgada (q=95 mozjpeg
    // + sharpen leve) sobrevive melhor à 2ª compressão. Limite de
    // 1600 cobre fotos grandes do ML/Shopee/Amazon sem upscale.
    const main = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .sharpen({ sigma: 0.6 })
      .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer()

    // jpegThumbnail é o que o WA exibe de cara em link previews e
    // imageMessages enquanto a mídia full-res é carregada. 200x200 q=60
    // estourava ao ser renderizado em cards grandes (~800px no retina).
    // 500x500 q=80 cabe folgado no campo protobuf (~50-80KB) e mantém
    // a foto nítida desde o primeiro frame.
    const thumbnail = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: 500, height: 500, fit: 'inside', withoutEnlargement: true })
      .sharpen({ sigma: 0.5 })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()

    return { buffer: main, mimetype: 'image/jpeg', jpegThumbnail: thumbnail }
  } catch {
    return null
  }
}

// Detecta mimetype a partir dos magic bytes do buffer.
// Retorna null se não for um formato de imagem reconhecido (sinal de download corrompido).
export function detectImageMime(buf) {
  if (!buf || buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  return null
}

// Baixa o conteúdo da imagem como Buffer enviando User-Agent/Referer adequados.
// Necessário para o WhatsApp porque a Baileys, ao passar `{ image: { url } }`,
// repassa a URL para o servidor de mídia do WhatsApp, que pode ser bloqueado
// pelo CDN da Shopee — resultando em imagem quebrada no destino.
// Tenta substituir a URL da imagem por uma variante de maior resolução
// quando o CDN permite. og:image dos marketplaces normalmente devolve uma
// versão média (~500px) que fica borrada quando o WA exibe em tela cheia.
function uniqueImageUrls(urls) {
  return [...new Set(urls.filter(Boolean))]
}

function buildAmazonImageUrlCandidates(rawUrl) {
  const candidates = []
  try {
    const u = new URL(rawUrl)
    const match = u.pathname.match(/^(.*?)(?:\._[^.\/]+_)?(\.[a-z0-9]+)$/i)
    if (!match) return [rawUrl]

    const [, base, ext] = match
    const highResSuffixes = ['._AC_SL1500_', '._SL1500_', '._AC_SY1200_', '._AC_UL1500_']
    for (const suffix of highResSuffixes) {
      const variant = new URL(rawUrl)
      variant.pathname = `${base}${suffix}${ext}`
      candidates.push(variant.toString())
    }

    candidates.push(rawUrl)

    const original = new URL(rawUrl)
    original.pathname = `${base}${ext}`
    candidates.push(original.toString())
  } catch {
    candidates.push(rawUrl)
  }
  return uniqueImageUrls(candidates)
}

function buildShopeeImageUrlCandidates(rawUrl) {
  const candidates = [rawUrl]
  try {
    const u = new URL(rawUrl)

    const withoutQuery = new URL(rawUrl)
    withoutQuery.search = ''
    if (withoutQuery.toString() !== rawUrl) candidates.unshift(withoutQuery.toString())

    // `_tn`, `_xxs`, `_sm`, `_xs` são variantes reduzidas do CDN — sempre
    // remova para chegar no original. `.webp` no fim é só a extensão do
    // formato e mantemos como está (sharp decodifica WebP sem problema).
    const withoutThumbSuffix = new URL(withoutQuery.toString())
    withoutThumbSuffix.pathname = withoutThumbSuffix.pathname.replace(/_(?:tn|xxs|xs|sm)(?=(?:\.[a-z0-9]+)?$)/i, '')
    if (withoutThumbSuffix.pathname !== u.pathname) candidates.unshift(withoutThumbSuffix.toString())

    const withoutFormatPath = new URL(withoutThumbSuffix.toString())
    withoutFormatPath.pathname = withoutFormatPath.pathname.replace(/\/(?:webp|jpeg|jpg|png)(?=\/|$)/i, '')
    if (withoutFormatPath.pathname !== withoutThumbSuffix.pathname) candidates.unshift(withoutFormatPath.toString())

    // Shopee distribui as mesmas imagens em dois CDNs: `cf.shopee.com.br` e
    // `down-br.img.susercontent.com`. Quando um responde com placeholder
    // (ou nada), o outro normalmente entrega a imagem original em melhor
    // qualidade — então adicionamos os dois como fallback.
    const cleanest = candidates[0]
    try {
      const alt = new URL(cleanest)
      if (alt.hostname === 'cf.shopee.com.br') {
        alt.hostname = 'down-br.img.susercontent.com'
        candidates.push(alt.toString())
      } else if (/susercontent\.com$/.test(alt.hostname)) {
        alt.hostname = 'cf.shopee.com.br'
        candidates.push(alt.toString())
      }
    } catch {}
  } catch {}
  return uniqueImageUrls(candidates)
}

function buildImageUrlCandidates(rawUrl) {
  const candidates = [rawUrl]
  try {
    const u = new URL(rawUrl)
    // Mercado Livre: D_NQ_NP_{id}-{country}.{ext} → D_NQ_NP_2X_{id}-{country}.{ext}
    // O prefixo 2X dobra a resolução (~500 → ~1000px).
    if (/^https?:\/\/(http2\.)?mlstatic\.com\//.test(rawUrl) && !/D_NQ_NP_2X_/.test(u.pathname)) {
      const ml = new URL(rawUrl)
      const upgraded = ml.pathname.replace(/\/D_NQ_NP_/, '/D_NQ_NP_2X_')
      if (upgraded !== ml.pathname) {
        ml.pathname = upgraded
        candidates.unshift(ml.toString())
      }
    }

    if (isShopeeImageUrl(rawUrl)) {
      return buildShopeeImageUrlCandidates(rawUrl)
    }

    // Amazon: gere variantes oficiais com sufixos de resize em alta resolução.
    // A URL sem sufixo (`.../ID.jpg`) fica por último porque alguns ASINs/CDNs
    // devolvem placeholder branco nesse caminho.
    if (isAmazonImageUrl(rawUrl)) {
      return buildAmazonImageUrlCandidates(rawUrl)
    }
  } catch {}
  return uniqueImageUrls(candidates)
}

async function validateDownloadedImage(buf) {
  const mime = detectImageMime(buf)
  if (!mime) return null

  try {
    const img = sharp(buf, { failOn: 'none' })
    const meta = await img.metadata()
    if (!meta?.width || !meta?.height) return null
    if (meta.width < IMAGE_MIN_DIMENSION_PX || meta.height < IMAGE_MIN_DIMENSION_PX) return null

  } catch {
    return null
  }

  return { buffer: buf, mimetype: mime }
}

async function fetchImageBufferRaw(imageUrl, refererUrl) {
  try {
    const headers = {
      'User-Agent': BROWSER_UA,
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }
    if (refererUrl) {
      try { headers['Referer'] = new URL(refererUrl).origin + '/' } catch {}
    }
    const res = await fetch(imageUrl, {
      headers,
      signal: AbortSignal.timeout(IMAGE_BUFFER_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentLength = Number(res.headers.get('content-length'))
    if (contentLength && contentLength > IMAGE_BUFFER_MAX_BYTES) return null

    const reader = res.body?.getReader()
    if (!reader) {
      const ab = await res.arrayBuffer()
      if (ab.byteLength > IMAGE_BUFFER_MAX_BYTES) return null
      const buf = Buffer.from(ab)
      return validateDownloadedImage(buf)
    }
    const chunks = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > IMAGE_BUFFER_MAX_BYTES) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)), received)
    return validateDownloadedImage(buf)
  } catch {
    return null
  }
}

export async function fetchImageBuffer(imageUrlRaw, refererUrl) {
  if (!imageUrlRaw) return null
  for (const candidate of buildImageUrlCandidates(imageUrlRaw)) {
    const image = await fetchImageBufferRaw(candidate, refererUrl)
    if (image) return image
  }
  return null
}
