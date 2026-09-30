// SHEIN: nome e preço do produto pela landing de afiliada `ark/7287`.
//
// Medido em 2026-09-30 (conta promosdaella; docs/rca/lojas-conversao.md,
// "SHEIN: nome vem do oneLink; preço…"): página de produto (`-p-<id>.html`),
// vitrine `ark/default` e APIs `productInfo/*` respondem captcha
// (`/risk/challenge`, `/risk/action/limit`) para IP de servidor, com e sem o
// cookie da cliente. A ÚNICA página que a SHEIN serve renderizada no servidor,
// sem sessão, é a landing de campanha de afiliada
//   https://m.shein.com/br/ark/7287?goods_id=<id>&test=5051&scene=1&ad_type=KOC&language=pt-br&siteuid=mbr
// (é para onde a própria vitrine `ark/default` manda o navegador via
// `history.replaceState`). Os parâmetros de campanha IMPORTAM: sem
// `test/scene/ad_type` a mesma página cai no captcha. Ela traz:
//   - `<div class="goods-name">` com o nome exato do produto;
//   - um JSON escapado (`\"goods_id\":<id>,…\"sale_price\":{…\"amountWithSymbol\":\"R$68,36\"}`)
//     com sale_price/retail_price/unit_discount DO produto pedido, além de
//     dezenas de outros produtos (recomendações) — por isso o preço é lido
//     SÓ do bloco que carrega o goods_id pedido, nunca o primeiro "R$" da
//     página (a vitrine tem 130+ preços de outros produtos).
// O bloco do produto aparece depois dos 700 KB — o teto de leitura precisa
// ser maior que o dos short links (512 KB).
//
// Falhou (captcha, sem nome para o id, rede) → devolve null e o scraper
// segue pelo caminho antigo (og:title do oneLink), sem regressão.
import { isSheinHostname } from '../detector.js'
import { extractSheinGoodsId, SHEIN_RISK_RE } from './shein.js'

const ARK_PAGE_ID = String(process.env.SHEIN_ARK_PAGE_ID || '7287').replace(/\D/g, '') || '7287'
const ARK_TIMEOUT_MS = Math.max(2000, Number(process.env.SHEIN_ARK_TIMEOUT_MS) || 8000)
const ARK_MAX_BYTES = 1.5 * 1024 * 1024
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'

export function buildSheinArkUrl(goodsId, pageId = ARK_PAGE_ID) {
  const id = String(goodsId || '').replace(/\D/g, '')
  if (!id) return null
  return `https://m.shein.com/br/ark/${pageId}?goods_id=${id}&test=5051&scene=1&ad_type=KOC&language=pt-br&siteuid=mbr`
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

/**
 * Lê nome e preços do HTML da landing. PURA. Devolve null se o HTML não
 * traz o produto pedido (captcha, id errado, layout mudou).
 * @returns {{ title:string, newPrice:string, oldPrice:string, discountPct:number|null, imageUrl:string } | null}
 */
export function parseSheinArkHtml(html, goodsId) {
  const raw = String(html || '')
  const id = String(goodsId || '').replace(/\D/g, '')
  if (!raw || !id) return null
  if (SHEIN_RISK_RE.test(raw.slice(0, 4000)) && !raw.includes('class="goods-name"')) return null

  // Desescapa o JSON embutido (`\"` → `"`, `\/` → `/`) antes de procurar.
  const text = raw.replace(/\\"/g, '"').replace(/\\\//g, '/')

  const nameMatch = text.match(/class="goods-name"[^>]*>([^<]{3,400})</i)
  let title = nameMatch ? decodeEntities(nameMatch[1]) : ''

  let newPrice = ''
  let oldPrice = ''
  let discountPct = null
  let imageUrl = ''
  const idRe = new RegExp(`"goods_id":"?${id}"?[,}]`, 'g')
  for (const m of text.matchAll(idRe)) {
    const seg = text.slice(m.index, m.index + 3000)
    const sale = seg.match(/"sale_price":\{[^}]*"amountWithSymbol":"([^"]+)"/)
    const retail = seg.match(/"retail_price":\{[^}]*"amountWithSymbol":"([^"]+)"/)
    if (!sale && !retail) continue
    newPrice = decodeEntities(sale?.[1] || '')
    oldPrice = decodeEntities(retail?.[1] || '')
    const disc = seg.match(/"unit_discount":"?(\d{1,2})"?/)
    if (disc) discountPct = Number(disc[1])
    if (!title) {
      const gn = seg.match(/"goods_name":"([^"]{3,400})"/)
      if (gn) title = decodeEntities(gn[1])
    }
    const img = seg.match(/"goods_img":"((?:https?:)?\/\/[^"]+)"/)
    if (img) imageUrl = img[1].startsWith('//') ? `https:${img[1]}` : img[1]
    break
  }

  if (!title) return null
  // Preço igual ao "de" = sem desconto: não mostrar "de/por" falso.
  if (oldPrice && newPrice && oldPrice === newPrice) oldPrice = ''
  return { title, newPrice, oldPrice, discountPct, imageUrl }
}

async function readLimited(res, maxBytes) {
  const reader = res.body?.getReader?.()
  if (!reader) return await res.text()
  const chunks = []
  let total = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      total += value.byteLength
      if (total >= maxBytes) { try { await reader.cancel() } catch {} ; break }
    }
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((c) => Buffer.from(c))))
}

/**
 * Busca nome/preço do produto SHEIN pelo goods_id. Devolve null em qualquer
 * falha (nunca lança) — quem chama cai no caminho antigo.
 */
export async function fetchSheinProductInfoByGoodsId(goodsId, { fetchImpl = globalThis.fetch, timeoutMs = ARK_TIMEOUT_MS } = {}) {
  const url = buildSheinArkUrl(goodsId)
  if (!url || typeof fetchImpl !== 'function') return null
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    })
    if (!res?.ok) return null
    const finalUrl = String(res.url || url)
    if (SHEIN_RISK_RE.test(finalUrl)) return null
    const html = await readLimited(res, ARK_MAX_BYTES)
    const parsed = parseSheinArkHtml(html, goodsId)
    return parsed ? { ...parsed, sourceUrl: url } : null
  } catch {
    return null
  }
}

/** goods_id a partir de qualquer URL da SHEIN já resolvida (`-p-<id>.html` ou `?goods_id=`). */
export function sheinGoodsIdFromUrl(url) {
  try {
    const parsed = new URL(String(url || ''))
    if (!isSheinHostname(parsed.hostname)) return null
  } catch {
    return null
  }
  return extractSheinGoodsId(url)
}
