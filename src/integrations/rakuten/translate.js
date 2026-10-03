// Tradutor PURO: resposta da Rakuten → registro interno. Sem rede, sem banco.
//
// O feed de ofertas (/coupon/1.0) só existe em XML. Formato real medido em
// 2026-09-30 (rede Brasil):
//   <couponfeed><TotalMatches>3</TotalMatches><TotalPages>1</TotalPages>
//     <link type="TEXT">
//       <categories><category id="25">Sapatos</category></categories>
//       <promotiontypes><promotiontype id="3">Liquidação</promotiontype></promotiontypes>
//       <offerdescription>Cupom de 10% OFF na primeira compra …</offerdescription>
//       <offerstartdate>2023-06-21T17:56Z</offerstartdate>
//       <offerenddate>2029-06-21T03:00Z</offerenddate>
//       <couponcode>BEMVINDO10</couponcode>            (só quando tem cupom)
//       <clickurl>https://click.linksynergy.com/fs-bin/click?id=…&amp;offerid=1897539.1097&amp;type=3&amp;subid=0</clickurl>
//       <advertiserid>43984</advertiserid><advertisername>Netshoes WL</advertisername>
//       <network id="8">Brazil Network</network>
//     </link>…
// Estrutura rasa e fixa: um leitor pequeno aqui evita dependência nova de
// XML (política de memória: nada de dependência pesada sem necessidade).

const TITLE_MAX = 300
const COUPON_MAX = 60
const URL_MAX = 2000
const NAME_MAX = 200

function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function safeChar(code) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
}

function innerText(raw) {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw)
  return cdata ? cdata[1] : decodeEntities(raw)
}

function tagText(block, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
  return match ? innerText(match[1]).trim() : ''
}

function tagAttr(block, tag, attr) {
  const match = new RegExp(`<${tag}\\s[^>]*\\b${attr}="([^"]*)"`, 'i').exec(block)
  return match ? decodeEntities(match[1]).trim() : ''
}

function allTagTexts(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi')
  const list = []
  for (let match = re.exec(block); match; match = re.exec(block)) {
    const text = innerText(match[1]).trim()
    if (text) list.push(text)
  }
  return list
}

function plainText(value, max) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function httpUrl(value) {
  const text = String(value ?? '').trim()
  if (!text || text.length > URL_MAX) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

// Logo da loja: o robô baixa esta imagem. Só https e host público — nunca
// endereço interno do servidor (revisão 2026-10-03, R16).
const PRIVATE_HOST_RE = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[.*\])$/i

export function publicHttpsUrl(value) {
  const url = httpUrl(value)
  if (!url) return null
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || PRIVATE_HOST_RE.test(parsed.hostname)) return null
  return url
}

// "2029-06-21T03:00Z" (medido) ou com segundos/fuso. Sem fuso = UTC.
export function parseRakutenDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`
  const at = Date.parse(iso)
  return Number.isFinite(at) ? new Date(at) : null
}

// → { items: [bloco XML de cada oferta], total, totalPages } | null
export function extractCouponPage(xml) {
  const text = String(xml ?? '')
  if (!/<couponfeed[\s>]/i.test(text)) return null
  const items = []
  const re = /<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/gi
  for (let match = re.exec(text); match; match = re.exec(text)) items.push(match[1])
  const toNumber = (value) => (value === '' || !Number.isFinite(Number(value)) ? null : Number(value))
  return { items, total: toNumber(tagText(text, 'TotalMatches')), totalPages: toNumber(tagText(text, 'TotalPages')) }
}

// Identidade estável da oferta: o `offerid` do link (medido: "1897539.1097"
// = programa.oferta). Sem ele, o próprio link sem o parâmetro de rastreio.
export function rakutenOfferId(clickUrl) {
  const url = httpUrl(clickUrl)
  if (!url) return null
  const parsed = new URL(url)
  const offerId = parsed.searchParams.get('offerid')
  if (offerId && /^[\w.-]{1,80}$/.test(offerId)) return offerId
  parsed.searchParams.delete('subid')
  return `u:${parsed.toString()}`.slice(0, 400)
}

// → { ok: true, record } | { ok: false, reason }
export function translateCoupon(block) {
  if (typeof block !== 'string' || !block.trim()) return { ok: false, reason: 'invalid' }
  const advertiserId = tagText(block, 'advertiserid')
  if (!/^\d{1,12}$/.test(advertiserId)) return { ok: false, reason: 'missing_advertiser' }
  const title = plainText(tagText(block, 'offerdescription'), TITLE_MAX)
  if (!title) return { ok: false, reason: 'missing_title' }
  const clickUrl = httpUrl(tagText(block, 'clickurl'))
  if (!clickUrl) return { ok: false, reason: 'missing_link' }
  const promotionId = rakutenOfferId(clickUrl)
  if (!promotionId) return { ok: false, reason: 'missing_link' }

  const couponCode = plainText(tagText(block, 'couponcode'), COUPON_MAX)
  return {
    ok: true,
    record: {
      promotionId,
      advertiserId,
      advertiserName: plainText(tagText(block, 'advertisername'), NAME_MAX) || `Loja ${advertiserId}`,
      title,
      couponCode: couponCode || null,
      promotionTypes: allTagTexts(block, 'promotiontype').slice(0, 5).join(', ').slice(0, 200),
      categories: allTagTexts(block, 'category').slice(0, 5).join(', ').slice(0, 200),
      clickUrl,
      networkId: tagAttr(block, 'network', 'id') || null,
      startDate: parseRakutenDate(tagText(block, 'offerstartdate')),
      endDate: parseRakutenDate(tagText(block, 'offerenddate')),
    },
  }
}

// /v2/advertisers/{id} → { name, storeUrl, logoUrl } | null
export function extractAdvertiser(body) {
  const advertiser = body?.advertiser
  if (!advertiser || typeof advertiser !== 'object') return null
  return {
    name: plainText(advertiser.name, NAME_MAX),
    storeUrl: httpUrl(advertiser.url),
    logoUrl: publicHttpsUrl(advertiser.logo_url),
  }
}
