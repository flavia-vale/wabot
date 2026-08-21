import sharp from 'sharp'
import { extractShopeeIds, resolveShopeeShortLink as resolveShopeeShortLinkShared } from './shopee.js'
import { resolveToCleanProductUrl, fetchFeaturedSocialImage, resolveSocialShareUrl, buildMlPictureUrl } from './mercadolivre.js'
import { fetchMercadoLivreApiImageId } from './productInfoScraper.js'
import { computeMutationCrop } from '../core/imageMutationCrop.js'
import { recordOperationalSignal } from '../observability/operationalSignals.js'

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
// Amazon embute as URLs em duas formas no HTML: como JSON inline com slashes
// escapadas (`https:\/\/`) e como atributos HTML com slashes normais. A regex
// antiga só pegava a forma escapada — em produção, a página atual da Amazon BR
// vem com slashes plain e o match nunca acontecia, derrubando a extração para
// og:image (que vem decorado com badges).
const AMAZON_INLINE_IMAGE_RE = /"(?:hiRes|large|mainUrl)"\s*:\s*"(https?:(?:\\\/\\\/|\/\/)[^"\\]+)"/gi
const AMAZON_ATTR_IMAGE_RE = /(?:data-old-hires|data-a-hires|src)=['"](https?:\/\/[^'"]*media-amazon\.com[^'"]+)['"]/gi
// /images/I/<ID>.<ext> seguido opcionalmente por tokens de overlay
// (`_BO`, `_UF`, `_SR`, `_PI*`, `_ZJ*`, `_QL*`, `_AC_SY*`, etc). Usado para
// recuperar o ID base e gerar variantes de alta resolução.
const AMAZON_IMAGE_ID_RE = /\/images\/I\/([A-Za-z0-9+\-]+)/
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
// HTML da Amazon BR hoje passa de 1.3MB; com o teto antigo de 512KB o
// `readLimitedText` cortava ANTES do meta com a imagem (offset ~320KB) e
// retornava null, descartando o que já havia sido coletado.
const IMAGE_HTML_MAX_BYTES = Number(process.env.IMAGE_HTML_MAX_BYTES) || 2 * 1024 * 1024
const IMAGE_BUFFER_TIMEOUT_MS = Number(process.env.IMAGE_BUFFER_TIMEOUT_MS) || 5_000
const IMAGE_BUFFER_MAX_BYTES = Number(process.env.IMAGE_BUFFER_MAX_BYTES) || 5 * 1024 * 1024
const IMAGE_MIN_DIMENSION_PX = Number(process.env.IMAGE_MIN_DIMENSION_PX) || 120
// Resolução mínima "hi-res" para link preview do WhatsApp em cards grandes.
// Marketplaces costumam ter variantes em 300/500/800/1500 — qualquer coisa
// abaixo de 800px no maior eixo aparece pixelizada no preview do WA mobile.
const IMAGE_HIRES_MIN_DIMENSION_PX = Number(process.env.IMAGE_HIRES_MIN_DIMENSION_PX) || 800

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
    chunks.push(value)
    if (received > IMAGE_HTML_MAX_BYTES) {
      // Para Amazon o meta og:image fica nos primeiros ~50KB e o
      // data-a-dynamic-image em ~320KB. Em vez de descartar tudo ao atingir
      // o teto, paramos a leitura e devolvemos o que já temos para extração.
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

// Muro anti-robô do Mercado Livre. É a lição mais cara do incidente de
// 2026-08-19/20: a parede vem com **status 200** e corpo de página normal, então
// "a página respondeu" não significa nada — sem reconhecê-la pelo nome, um
// bloqueio da loja vira "sem foto" genérico e custa um dia de investigação.
//
// Marcadores confirmados em produção: o app `suspicious-traffic-frontend` e a
// rota de verificação de conta. Nenhum dos dois aparece em página de produto
// legítima.
const ANTI_BOT_WALL_RE = /suspicious-traffic|\/gz\/account-verification/i

export function isAntiBotWallHtml(html) {
  if (typeof html !== 'string' || !html) return false
  return ANTI_BOT_WALL_RE.test(html)
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

const AMAZON_SHORT_HOST_RE = /^(amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzn\.divulguei\.app)$/

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

// meli.la/mluvem.com/`/sec/` são short links de afiliado do ML: um fetch cru
// com apenas redirect HTTP (resolveByHtmlLayers) pode cair numa landing
// intermediária que devolve 200 com HTML de app-install/recomendações em vez
// do produto (`resolve()` em mercadolivre.js documenta esse caso — "Alguns
// meli.la retornam 200 com HTML intermediário (sem 3xx)"). O og:image dessa
// landing é de um produto aleatório/rotativo, não o compartilhado — causa
// confirmada do texto/link batendo com um produto e a imagem vindo de outro.
// resolveToCleanProductUrl já faz essa resolução completa (usada para montar
// o link de afiliado do texto); reaproveitamos aqui para a imagem também.
// A foto da vitrine vem ANTES da página do produto de propósito (RCA
// 2026-08-19/20): o ML passou a servir o muro anti-robô para o IP do servidor,
// e a página do produto responde 200 SEM `og:image` — o leitor de HTML não tem
// o que ler e a oferta sai sem foto. A página da vitrine (`/social/?ref=`)
// continua acessível e já traz a foto do card destacado, então ela é a fonte
// confiável hoje. A leitura da página do produto segue como segunda opção: se
// o bloqueio cair, ela volta a funcionar sozinha.
async function resolveMercadoLivreImage(url, creds) {
  const socialUrl = await resolveSocialShareUrl(url)
  if (socialUrl) {
    const fromCard = await fetchFeaturedSocialImage(socialUrl).catch(() => null)
    if (fromCard) return fromCard
  }
  const target = (await resolveToCleanProductUrl(url).catch(() => null)) || url

  // 2ª fonte: a API do ML, que já entrega título e preço para esta mesma oferta
  // e traz `pictures[]` na MESMA resposta (fetchMercadoLivreApiImageId). Entra
  // ANTES da página do produto porque a página é justamente a que o muro
  // anti-robô barra — de um IP bloqueado ela responde 200 e sem foto, então
  // tentá-la primeiro só gastaria o orçamento de tempo da mensagem. Fica DEPOIS
  // da vitrine porque a vitrine já está provada em produção e não gasta token.
  const apiPictureId = await fetchMercadoLivreApiImageId(target, { mlCredentials: creds?.mercadolivre || null }).catch(() => null)
  const fromApi = buildMlPictureUrl(apiPictureId)
  if (fromApi) return fromApi

  const { html } = await fetchHtml(target, { ua: BROWSER_UA }).catch(() => ({ html: null }))
  // Bloqueio da loja tem nome próprio no log e sinal durável. Sem isso, o
  // muro (que responde 200) se disfarça de "página sem imagem" — foi assim
  // que o incidente de 2026-08-19/20 passou um dia sem diagnóstico.
  if (isAntiBotWallHtml(html)) {
    recordOperationalSignal('ml_anti_bot_wall', { url: target })
    return null
  }
  return extractImageFromHtmlLayers(html)
}

// A página do oneLink da SHEIN (não a página de produto — bloqueada por
// captcha, research.md D-004) serve og:image com a foto do produto, mas em
// tamanho de miniatura: img.ltwebstatic.com/.../<id>_thumbnail_<w>x<h>.<ext>.
// Removendo o sufixo `_thumbnail_<w>x<h>`, o mesmo CDN devolve a imagem
// original — medido ao vivo em 1340x1785 (acima de
// IMAGE_HIRES_MIN_DIMENSION_PX). Mesmo padrão de strip de CDN já usado para
// Amazon (`_AC_SL1500_`) e Shopee (`_tn`, `@resize_w`). A extração do
// og:image em si (que já devolve essa URL de miniatura) é feita pelo caminho
// genérico em `fetchProductImage` (`resolveByHtmlLayers`) — não há ramo
// dedicado de SHEIN ali, então não há fetch duplicado do mesmo HTML.
const SHEIN_IMAGE_THUMBNAIL_SUFFIX_RE = /_thumbnail_\d+x\d+(?=\.[a-z0-9]+(?:[?#]|$))/i
const SHEIN_IMAGE_HOST_RE = /(^|\.)ltwebstatic\.com$/i

function stripSheinImageThumbnailSuffix(rawUrl) {
  if (!rawUrl) return rawUrl
  try {
    const u = new URL(rawUrl)
    if (!SHEIN_IMAGE_HOST_RE.test(u.hostname)) return rawUrl
    u.pathname = u.pathname.replace(SHEIN_IMAGE_THUMBNAIL_SUFFIX_RE, '')
    return u.toString()
  } catch {
    return rawUrl
  }
}

function isSheinImageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    return SHEIN_IMAGE_HOST_RE.test(u.hostname)
  } catch {
    return false
  }
}

// Lista de candidatos (não reescrita destrutiva): a URL sem o sufixo de
// miniatura vem primeiro (é a de alta resolução), e a URL original de
// miniatura fica como fallback — mesmo padrão de
// `buildAmazonImageUrlCandidates`/`buildShopeeImageUrlCandidates` logo abaixo.
// Se a variante em alta resolução responder 404/placeholder, `fetchImageBuffer`
// cai para a miniatura original (que funcionava) em vez de a oferta sair sem
// foto (SC-004).
function buildSheinImageUrlCandidates(rawUrl) {
  const stripped = stripSheinImageThumbnailSuffix(rawUrl)
  return uniqueImageUrls([stripped, rawUrl])
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


// Extrai (shopid, itemid) de URLs Shopee — parsing delegado a shopee.js
// (extractShopeeIds), que também cobre IDs URL-encoded em query param.
function parseShopeeIds(url) {
  try {
    const u = new URL(url)
    if (!/shopee\.com\.br$/.test(u.hostname)) return null
  } catch { return null }
  const ids = extractShopeeIds(url)
  return ids ? { shopid: ids.shopId, itemid: ids.itemId } : null
}

// Resolve short links da Shopee (shope.ee, s.shopee.com.br) para a URL
// canônica — resolvedor compartilhado em shopee.js (segue redirects
// manualmente, carrega cookies da cadeia e tolera interstitials JS/anti-bot).
async function resolveShopeeShortLink(url) {
  return resolveShopeeShortLinkShared(url, { timeoutMs: IMAGE_HTML_FETCH_TIMEOUT_MS })
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
    } else if (platform === 'mercadolivre') {
      image = await resolveMercadoLivreImage(productUrl, creds)
    }
    // SHEIN não tem ramo dedicado: o caminho genérico abaixo já extrai o
    // og:image do oneLink (miniatura `_thumbnail_<w>x<h>`), e
    // `buildSheinImageUrlCandidates` (usado em `buildImageUrlCandidates`,
    // dentro de `fetchImageBuffer`) troca para a variante em alta resolução
    // no momento do download, com fallback para a miniatura original. Um
    // ramo dedicado aqui repetiria o MESMO fetch de HTML que a linha abaixo
    // já faz (T069 — RCA de fetch duplicado dentro do orçamento de 25s).
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
// `opts.mutation` (opcional): { groupId, date? } liga o anti-fingerprint de
// canal — crop determinístico de 1-2px + qualidade JPEG variada (85-92)
// aplicados NESTE MESMO encode (sem 2º encode JPEG sobre a imagem já q95).
// Default (sem mutation) = comportamento histórico idêntico (q95 mozjpeg 4:4:4).
export async function normalizeImageForWhatsApp(buf, opts = {}) {
  if (!buf?.length) return null
  const mutation = opts.mutation || null
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata()
    if (!meta?.width || !meta?.height) return null

    // Converte para JPEG; redimensiona se for absurdamente grande.
    // Resolução/qualidade calibradas para o WA: WhatsApp recomprime na
    // própria infra, então enviar com qualidade folgada (q=95 mozjpeg
    // + sharpen leve) sobrevive melhor à 2ª compressão. Limite de
    // 1600 cobre fotos grandes do ML/Shopee/Amazon sem upscale.
    let main
    let mainWidth
    let mainHeight
    if (mutation) {
      // Anti-fingerprint de canal num ÚNICO encode JPEG: renderiza resize+
      // sharpen em RAW (lossless) só para medir as dimensões pós-resize e
      // recortar; o crop + a qualidade variada vão no único toBuffer() JPEG.
      // Falha na mutação NUNCA derruba o envio — cai para o encode q95 normal.
      try {
        const { data, info } = await sharp(buf, { failOn: 'none' })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .sharpen({ sigma: 0.6 })
          .raw()
          .toBuffer({ resolveWithObject: true })
        const crop = computeMutationCrop(info, { groupId: mutation.groupId, date: mutation.date })
        let pipeline = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        if (crop) pipeline = pipeline.extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
        const encoded = await pipeline
          .jpeg({ quality: crop ? crop.quality : 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
          .toBuffer({ resolveWithObject: true })
        main = encoded.data
        mainWidth = encoded.info.width
        mainHeight = encoded.info.height
      } catch {
        const encoded = await sharp(buf, { failOn: 'none' })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .sharpen({ sigma: 0.6 })
          .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
          .toBuffer({ resolveWithObject: true })
        main = encoded.data
        mainWidth = encoded.info.width
        mainHeight = encoded.info.height
      }
    } else {
      const encoded = await sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .sharpen({ sigma: 0.6 })
        .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
        .toBuffer({ resolveWithObject: true })
      main = encoded.data
      mainWidth = encoded.info.width
      mainHeight = encoded.info.height
    }

    // jpegThumbnail é o que o WA exibe de cara em link previews e
    // imageMessages enquanto a mídia full-res é carregada. 200x200 q=60
    // estourava ao ser renderizado em cards grandes (~800px no retina).
    // 500x500 q=80 cabe folgado no campo protobuf (~50-80KB) e mantém
    // a foto nítida desde o primeiro frame. (O thumbnail não é mutado —
    // anti-fingerprint sempre incidiu só sobre a imagem principal.)
    const thumbnail = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize({ width: 500, height: 500, fit: 'inside', withoutEnlargement: true })
      .sharpen({ sigma: 0.5 })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()

    // width/height do buffer FINAL (pós-resize/crop) precisam ir explícitos no
    // payload de envio: como já fornecemos jpegThumbnail pronto, o Baileys
    // PULA sua própria extração de dimensões (só roda dentro do bloco que
    // gera o thumbnail internamente — Utils/messages.js:132-162) e o
    // imageMessage sai sem width/height no proto. Sem esses campos, o
    // WhatsApp não sabe o tamanho real da foto para reservar o espaço do
    // balão e renderiza um card pequeno (regressão silenciosa introduzida
    // junto com a otimização de pré-gerar o thumbnail — ver
    // buildMonitoredMessagePayload, que repassa estes campos no payload real
    // de imagem).
    return { buffer: main, mimetype: 'image/jpeg', jpegThumbnail: thumbnail, width: mainWidth, height: mainHeight }
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
  try {
    const u = new URL(rawUrl)
    // O ID do produto é o primeiro segmento após /images/I/. Tudo depois
    // (`.jpg`, `._AC_SY450_`, badges `_BO/_UF/_SR/_PI/_ZJ/_QL`, ...) é
    // processamento do CDN e pode ser substituído à vontade.
    const idMatch = u.pathname.match(AMAZON_IMAGE_ID_RE)
    if (!idMatch) return [rawUrl]
    const id = idMatch[1]
    const baseDir = u.pathname.slice(0, u.pathname.indexOf('/images/I/') + '/images/I/'.length)
    const build = (suffixPath) => {
      const v = new URL(rawUrl)
      v.pathname = baseDir + id + suffixPath
      v.search = ''
      return v.toString()
    }
    // Ordem importa: primeiro as variantes de alta resolução, depois a forma
    // crua (`.jpg`) que alguns ASINs servem com placeholder branco, e por
    // último a URL original com possíveis badges/decorações.
    return uniqueImageUrls([
      build('._AC_SL1500_.jpg'),
      build('._SL1500_.jpg'),
      build('._AC_UL1500_.jpg'),
      build('._AC_SX1500_.jpg'),
      build('.jpg'),
      rawUrl,
    ])
  } catch {
    return [rawUrl]
  }
}

function buildShopeeImageUrlCandidates(rawUrl) {
  const candidates = [rawUrl]
  try {
    const u = new URL(rawUrl)

    const withoutQuery = new URL(rawUrl)
    withoutQuery.search = ''
    if (withoutQuery.toString() !== rawUrl) candidates.unshift(withoutQuery.toString())

    // `_tn`, `_xxs`, `_sm`, `_xs`, `_md`, `_lg` são variantes reduzidas do
    // CDN — sempre remova para chegar no original. `.webp` no fim é só a
    // extensão do formato e mantemos como está (sharp decodifica WebP).
    const withoutThumbSuffix = new URL(withoutQuery.toString())
    withoutThumbSuffix.pathname = withoutThumbSuffix.pathname.replace(/_(?:tn|xxs|xs|sm|md|lg)(?=(?:\.[a-z0-9]+)?$)/i, '')
    if (withoutThumbSuffix.pathname !== u.pathname) candidates.unshift(withoutThumbSuffix.toString())

    // Sufixo `@resize_w320[_n[lh]]` é o novo formato de processamento do CDN
    // Shopee (estilo Imgix) — também só serve uma versão pequena. Removendo
    // chegamos à imagem original.
    const withoutResize = new URL(withoutThumbSuffix.toString())
    withoutResize.pathname = withoutResize.pathname.replace(/@resize_w\d+(?:_n[lh])?/i, '')
    if (withoutResize.pathname !== withoutThumbSuffix.pathname) candidates.unshift(withoutResize.toString())

    const withoutFormatPath = new URL(withoutResize.toString())
    withoutFormatPath.pathname = withoutFormatPath.pathname.replace(/\/(?:webp|jpeg|jpg|png)(?=\/|$)/i, '')
    if (withoutFormatPath.pathname !== withoutResize.pathname) candidates.unshift(withoutFormatPath.toString())

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

    // SHEIN: URL sem o sufixo `_thumbnail_<w>x<h>` primeiro (alta resolução),
    // com a miniatura original como fallback — ver comentário em
    // `buildSheinImageUrlCandidates`.
    if (isSheinImageUrl(rawUrl)) {
      return buildSheinImageUrlCandidates(rawUrl)
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

  let width = 0
  let height = 0
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata()
    if (!meta?.width || !meta?.height) return null
    if (meta.width < IMAGE_MIN_DIMENSION_PX || meta.height < IMAGE_MIN_DIMENSION_PX) return null
    width = meta.width
    height = meta.height
  } catch {
    return null
  }

  return { buffer: buf, mimetype: mime, width, height }
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
  let fallback = null
  for (const candidate of buildImageUrlCandidates(imageUrlRaw)) {
    const image = await fetchImageBufferRaw(candidate, refererUrl)
    if (!image) continue
    // Marketplaces servem múltiplas variantes da mesma imagem; preferimos a
    // primeira que atinja resolução hi-res (≥800px no maior eixo) para o
    // preview do WhatsApp não exibir versão borrada. Guardamos a melhor
    // variante "pequena" como fallback caso nenhuma hi-res esteja disponível.
    const largestAxis = Math.max(image.width || 0, image.height || 0)
    if (largestAxis >= IMAGE_HIRES_MIN_DIMENSION_PX) return image
    if (!fallback || largestAxis > Math.max(fallback.width || 0, fallback.height || 0)) {
      fallback = image
    }
  }
  return fallback
}
