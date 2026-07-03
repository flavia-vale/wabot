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
// Label sempre "Cupom + Loja": link de cupom não tem produto, e sem o
// prefixo "Cupom" o card ficava ambíguo com um card de produto de verdade
// (a cliente reportou confusão — pediu explicitamente "Cupom Amazon",
// "Cupom Shopee" etc. em vez de só o nome da loja).
const BRAND_STYLES = {
  amazon: { label: 'Cupom Amazon', bg: '#131A22', fg: '#FFFFFF', accent: '#FF9900' },
  shopee: { label: 'Cupom Shopee', bg: '#EE4D2D', fg: '#FFFFFF', accent: '#FFFFFF' },
  mercadolivre: { label: 'Cupom Mercado Livre', bg: '#FFE600', fg: '#2D3277', accent: '#2D3277' },
  magazineluiza: { label: 'Cupom Magalu', bg: '#0086FF', fg: '#FFFFFF', accent: '#FFFFFF' },
}

const WIDTH = 800
const HEIGHT = 420

// Banner é determinístico por plataforma → gera uma vez por processo.
// Falha de render também é cacheada (null) para não tentar de novo a cada
// mensagem num ambiente sem suporte a SVG/fontes.
const cache = new Map()

// Auto-size grosseiro por comprimento do label (glyph bold ~0.58*fontSize de
// largura média) para o texto mais longo ("Cupom Mercado Livre", 19 chars)
// não estourar os 800px do banner — antes só havia 2 níveis (>8 chars → 84),
// insuficiente depois de todo label ganhar o prefixo "Cupom ".
function fontSizeForLabel(label) {
  const len = label.length
  if (len <= 12) return 96
  if (len <= 16) return 78
  if (len <= 20) return 62
  return 50
}

function buildBrandSvg({ label, bg, fg, accent }) {
  const fontSize = fontSizeForLabel(label)
  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
  <text x="${WIDTH / 2}" y="${HEIGHT / 2}" dominant-baseline="central" text-anchor="middle" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${label}</text>
  <rect x="${WIDTH / 2 - 120}" y="${HEIGHT / 2 + fontSize * 0.75}" width="240" height="10" rx="5" fill="${accent}"/>
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
