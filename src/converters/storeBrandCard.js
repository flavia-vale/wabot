import sharp from 'sharp'

// Banner de marca por loja para o card clicável (modo preview) de links de
// CUPOM/campanha. Link de cupom não tem produto: raspar a landing pegava a
// imagem de um produto promovido ALEATÓRIO (ex.: capa de livro no card do
// cupom Prime Day). O padrão de mercado (concorrentes) é mostrar a marca da
// loja. Geramos o banner localmente — tipografia sobre a cor da marca, sem
// logo oficial e sem depender de CDN de terceiros (que muda/expira).
//
// Restrições herdadas do incidente da "arte SVG" (PR #1185, não regredir):
// - Nada de emoji no SVG (librsvg do sharp não renderiza — vira tofu).
// - font-family termina em sans-serif genérico: o VPS não tem Arial; o
//   fontconfig resolve para DejaVu Sans, que renderiza texto latino normal.
// - Saída é JPEG flat pequeno (~15-40KB), longe de qualquer limite de proto.
//
// CANVAS QUADRADO (não regredir para 800x420 landscape): staging mostrou o
// texto "Cupom Amazon" cortado nas bordas ("oom Ama") no WhatsApp Desktop.
// O card compacto de link preview do WhatsApp recorta a thumbnail pro CENTRO
// de um box aproximadamente quadrado — uma imagem landscape 800x420 perdia
// ~24% de cada lado nesse recorte, cortando texto perto das bordas. Um
// canvas quadrado não sofre esse corte (nada a recortar), e é a mesma
// explicação por trás do card ainda saindo "pequeno": o box de exibição no
// Desktop já é per se compacto/quadrado, então uma imagem larga sempre
// aparentava "fina" ali. Texto em duas linhas ("CUPOM" pequeno em cima,
// nome da loja grande embaixo) também evita precisar espremer o label
// inteiro numa única linha larga.
const BRAND_STYLES = {
  amazon: { store: 'Amazon', bg: '#131A22', fg: '#FFFFFF', accent: '#FF9900' },
  shopee: { store: 'Shopee', bg: '#EE4D2D', fg: '#FFFFFF', accent: '#FFFFFF' },
  mercadolivre: { store: 'Mercado Livre', bg: '#FFE600', fg: '#2D3277', accent: '#2D3277' },
  magazineluiza: { store: 'Magalu', bg: '#0086FF', fg: '#FFFFFF', accent: '#FFFFFF' },
}

const WIDTH = 720
const HEIGHT = 720
const COUPON_LABEL_FONT_SIZE = 60

// Banner é determinístico por plataforma → gera uma vez por processo.
// Falha de render também é cacheada (null) para não tentar de novo a cada
// mensagem num ambiente sem suporte a SVG/fontes.
const cache = new Map()

// Auto-size grosseiro por comprimento do NOME DA LOJA (glyph bold
// ~0.58*fontSize de largura média), mantendo o texto dentro de uma margem
// segura (~600px de 720) mesmo se o crop do card não for perfeitamente
// quadrado. "Mercado Livre" (13 chars) é o mais longo hoje.
function fontSizeForStoreName(store) {
  const len = store.length
  if (len <= 8) return 130
  if (len <= 14) return 78
  return 56
}

function buildBrandSvg({ store, bg, fg, accent }) {
  const storeFontSize = fontSizeForStoreName(store)
  const labelY = HEIGHT * 0.32
  const storeY = HEIGHT * 0.58
  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
  <text x="${WIDTH / 2}" y="${labelY}" dominant-baseline="central" text-anchor="middle" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${COUPON_LABEL_FONT_SIZE}" font-weight="700" letter-spacing="6" fill="${accent}">CUPOM</text>
  <text x="${WIDTH / 2}" y="${storeY}" dominant-baseline="central" text-anchor="middle" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${storeFontSize}" font-weight="700" fill="${fg}">${store}</text>
  <rect x="${WIDTH / 2 - 100}" y="${storeY + storeFontSize * 0.7}" width="200" height="8" rx="4" fill="${accent}"/>
</svg>`
}

export function isBrandCardPlatform(platform) {
  return Object.prototype.hasOwnProperty.call(BRAND_STYLES, String(platform || ''))
}

export async function buildStoreBrandCardImage(platform) {
  const key = String(platform || '')
  if (!isBrandCardPlatform(key)) return null
  if (cache.has(key)) return cache.get(key)
  let buffer = null
  try {
    buffer = await sharp(Buffer.from(buildBrandSvg(BRAND_STYLES[key])))
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()
  } catch {
    buffer = null
  }
  cache.set(key, buffer)
  return buffer
}

export const __storeBrandCardInternals = { BRAND_STYLES, WIDTH, HEIGHT, cache }
