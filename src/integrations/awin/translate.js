// Tradutor PURO: resposta da Awin → registro interno. Sem rede, sem banco.
//
// Formato real medido em 2026-09-29 (conta 2701264), que DIFERE da doc:
// - envelope de promoções: { data: [...], pagination: { page, pageSize, total } }
// - envelope de contas: { userId, accounts: [...] }
// - datas vêm COM fuso ("2026-09-28T03:00:00+00:00"); a doc
//   (https://help.awin.com/apidocs/promotions) diz "YYYY-MM-DDT00:00:00.000"
//   em UTC, sem fuso. parseAwinDate aceita os dois (sem fuso = UTC).

const TITLE_MAX = 300
const DESCRIPTION_MAX = 2000
const TERMS_MAX = 4000
const URL_MAX = 2000

const HAS_TIMEZONE_RE = /(Z|[+-]\d{2}:?\d{2})$/i

export function parseAwinDate(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const iso = HAS_TIMEZONE_RE.test(text) ? text : `${text}Z`
  const at = Date.parse(iso)
  return Number.isFinite(at) ? new Date(at) : null
}

function firstArray(body, key) {
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body[key])) return body[key]
  return null
}

export function extractAccounts(body) {
  const list = firstArray(body, 'accounts')
  if (!list) return null
  return list
    .filter((item) => item && item.accountId != null)
    .map((item) => ({
      accountId: String(item.accountId),
      accountName: item.accountName ? String(item.accountName) : '',
      accountType: item.accountType ? String(item.accountType) : '',
      userRole: item.userRole ? String(item.userRole) : '',
    }))
}

export function extractPromotionPage(body) {
  const items = firstArray(body, 'data')
  if (!items) return null
  const totalRaw = body?.pagination?.total
  const total = Number.isFinite(Number(totalRaw)) && totalRaw !== null && totalRaw !== '' ? Number(totalRaw) : null
  return { items, total }
}

function plainText(value, max) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
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

// Vale no Brasil? `regions.all` = todas as regiões; senão procura BR na lista.
// Sem o objeto `regions`, confiamos no filtro regionCodes:["BR"] do pedido.
export function isValidInBrazil(regions) {
  if (!regions || typeof regions !== 'object') return true
  if (regions.all === true) return true
  if (!Array.isArray(regions.list)) return true
  return regions.list.some((region) => String(region?.countryCode ?? '').toUpperCase() === 'BR')
}

export function trackingHasPublisher(urlTracking, publisherId) {
  const url = httpUrl(urlTracking)
  if (!url) return false
  const params = new URL(url).searchParams
  return params.get('awinaffid') === String(publisherId) || params.get('id') === String(publisherId)
}

// → { ok: true, record } | { ok: false, reason }
export function translatePromotion(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'invalid' }
  if (raw.type && String(raw.type) !== 'promotion') return { ok: false, reason: 'not_promotion' }
  if (raw.promotionId == null || String(raw.promotionId).trim() === '') return { ok: false, reason: 'missing_id' }
  const advertiserId = raw.advertiser?.id
  if (advertiserId == null) return { ok: false, reason: 'missing_advertiser' }
  const title = plainText(raw.title, TITLE_MAX)
  if (!title) return { ok: false, reason: 'missing_title' }
  const urlTracking = httpUrl(raw.urlTracking)
  if (!urlTracking) return { ok: false, reason: 'missing_link' }
  if (!isValidInBrazil(raw.regions)) return { ok: false, reason: 'not_brazil' }

  return {
    ok: true,
    record: {
      promotionId: String(raw.promotionId).trim(),
      advertiserId: String(advertiserId),
      advertiserName: plainText(raw.advertiser?.name, 200) || `Loja ${advertiserId}`,
      title,
      description: plainText(raw.description, DESCRIPTION_MAX),
      terms: plainText(raw.terms, TERMS_MAX),
      url: httpUrl(raw.url),
      urlTracking,
      regionsJson: JSON.stringify(raw.regions ?? {}).slice(0, 4000),
      startDate: parseAwinDate(raw.startDate),
      endDate: parseAwinDate(raw.endDate),
      dateAdded: parseAwinDate(raw.dateAdded),
    },
  }
}
