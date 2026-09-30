// Lojas da Awin no link: de qual loja aprovada é esta URL? Funções PURAS — sem
// rede, sem banco, sem relógio. Usadas pelo espelhamento, pelo "Converter
// links" e pelo "Criar oferta".
//
// Fonte (medido em 2026-09-29, conta 2701264, 12 lojas joined+BR):
// GET /publishers/{id}/programmes → validDomains = [{ domain: "*.kabum.com" },
// { domain: "kabum.com.br" }, ...] + displayUrl "https://www.kabum.com.br/".
// https://help.awin.com/apidocs/get-program-information
//
// Link de afiliado da Awin (Central de Ajuda):
// https://www.awin1.com/cread.php?awinmid=<loja>&awinaffid=<publisher>&ued=<url>
// https://success.awin.com/articles/en_US/Knowledge/What-does-an-affiliate-link-look-like
// O link curto oficial é tidd.ly (Link Builder com shorten).

export const AWIN_CLICK_HOSTS = ['awin1.com']
export const AWIN_SHORT_HOSTS = ['tidd.ly']
const AWIN_CLICK_PATH_RE = /^\/(?:cread|awclick|pclick)\.php$/i
const MAX_DOMAINS_PER_STORE = 30
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,62})(?:\.[a-z0-9-]{1,63})+$/

function hostOf(url) {
  try {
    const parsed = new URL(String(url ?? ''))
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.hostname.toLowerCase().replace(/\.+$/, '')
  } catch {
    return null
  }
}

function hostIn(host, list) {
  return Boolean(host) && list.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

/**
 * "*.kabum.com" / "https://www.kabum.com.br/" / "kabum.com.br" → domínio base
 * ("kabum.com", "kabum.com.br"). O "www." sai para que www e sem www casem.
 * Qualquer coisa que não seja um domínio público vira null.
 */
export function normalizeStoreDomain(value) {
  let raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return null
  raw = raw.replace(/^[a-z]+:\/\//, '').replace(/^\*\./, '').split(/[/?#:]/)[0].replace(/\.+$/, '')
  raw = raw.replace(/^www\./, '')
  if (!DOMAIN_RE.test(raw)) return null
  // Nunca a própria Awin como domínio de loja (o link dela é tratado à parte).
  if (hostIn(raw, AWIN_CLICK_HOSTS) || hostIn(raw, AWIN_SHORT_HOSTS)) return null
  return raw
}

/** Resposta de /programmes → lojas com domínios normalizados. */
export function extractProgrammes(body) {
  const list = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : null)
  if (!list) return null
  const out = []
  for (const item of list) {
    const advertiserId = Number(item?.id)
    if (!Number.isSafeInteger(advertiserId) || advertiserId <= 0) continue
    const candidates = [
      ...(Array.isArray(item.validDomains) ? item.validDomains.map((entry) => entry?.domain ?? entry) : []),
      item.displayUrl,
    ]
    const domains = [...new Set(candidates.map(normalizeStoreDomain).filter(Boolean))].slice(0, MAX_DOMAINS_PER_STORE)
    out.push({
      advertiserId,
      name: String(item.name ?? '').trim().slice(0, 200) || `Loja ${advertiserId}`,
      displayUrl: typeof item.displayUrl === 'string' ? item.displayUrl.slice(0, 500) : null,
      // Logo da loja: última camada da foto das promoções (a oferta nunca sai
      // só com texto — RCA 2026-09-30).
      logoUrl: /^https:\/\/[^\s]{4,500}$/i.test(String(item.logoUrl ?? '')) ? String(item.logoUrl) : null,
      domains,
    })
  }
  return out
}

/** O link é da Awin (awin1.com/cread.php ou tidd.ly)? */
export function isAwinTrackingUrl(url) {
  const host = hostOf(url)
  if (!host) return false
  if (hostIn(host, AWIN_SHORT_HOSTS)) return true
  if (!hostIn(host, AWIN_CLICK_HOSTS)) return false
  try {
    return AWIN_CLICK_PATH_RE.test(new URL(url).pathname)
  } catch {
    return false
  }
}

export function isAwinShortUrl(url) {
  return hostIn(hostOf(url), AWIN_SHORT_HOSTS)
}

/**
 * awin1.com/cread.php?awinmid=&awinaffid=&ued= → { advertiserId, publisherId,
 * destinationUrl }. `awclick.php` usa `p` no lugar de `ued`. null se não for
 * link de clique da Awin.
 */
export function parseAwinClickUrl(url) {
  const host = hostOf(url)
  if (!hostIn(host, AWIN_CLICK_HOSTS)) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!AWIN_CLICK_PATH_RE.test(parsed.pathname)) return null
  const params = parsed.searchParams
  const destination = params.get('ued') || params.get('p') || null
  const advertiserId = Number(params.get('awinmid') || params.get('mid'))
  const publisherId = String(params.get('awinaffid') || params.get('id') || '').trim()
  return {
    advertiserId: Number.isSafeInteger(advertiserId) && advertiserId > 0 ? advertiserId : null,
    publisherId: /^\d{1,12}$/.test(publisherId) ? publisherId : null,
    destinationUrl: hostOf(destination) ? destination : null,
  }
}

// Parâmetros de rastreio de terceiros que não mudam a página: saem antes de
// gerar o link (senão o utm do concorrente vai junto e cada variação vira uma
// entrada nova no cache).
const TRACKING_PARAM_RE = /^(?:utm_[a-z_]+|awc|sv1|sv_campaign_id|sv_tax\d*|gclid|fbclid)$/i

export function cleanDestinationUrl(url) {
  let parsed
  try {
    parsed = new URL(String(url ?? ''))
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM_RE.test(key)) parsed.searchParams.delete(key)
  }
  parsed.hash = ''
  return parsed.toString()
}

/** Link longo documentado — montado aqui, sem chamada à Awin. */
export function buildAwinDeepLink({ advertiserId, publisherId, destinationUrl }) {
  const url = new URL('https://www.awin1.com/cread.php')
  url.searchParams.set('awinmid', String(advertiserId))
  url.searchParams.set('awinaffid', String(publisherId))
  if (destinationUrl) url.searchParams.set('ued', destinationUrl)
  return url.toString()
}

/**
 * Lojas aprovadas da cliente → "de qual loja é esta URL?". `stores` =
 * [{ accountId, publisherId, advertiserId, name, domains }]. A mesma loja em
 * duas contas: vale a primeira da lista (quem monta decide a ordem).
 */
export function createAwinStoreMatcher(stores = [], { publisherIds = [] } = {}) {
  const ownPublishers = new Set([...publisherIds].map(String))
  const byDomain = new Map()
  const byAdvertiser = new Map()
  for (const store of stores) {
    if (!store?.advertiserId) continue
    if (!byAdvertiser.has(store.advertiserId)) byAdvertiser.set(store.advertiserId, store)
    for (const domain of store.domains || []) {
      if (!byDomain.has(domain)) byDomain.set(domain, store)
    }
  }
  const domainsLongestFirst = [...byDomain.keys()].sort((a, b) => b.length - a.length)

  function storeForUrl(url) {
    const host = hostOf(url)
    if (!host) return null
    for (const domain of domainsLongestFirst) {
      if (host === domain || host.endsWith(`.${domain}`)) return byDomain.get(domain)
    }
    return null
  }

  // Link de clique da Awin (cread.php): dá para saber SEM rede se é de loja
  // aprovada (awinmid ou página de destino) ou se já é dela. Loja não aprovada
  // → false → o sanitizador apaga o link, igual a antes (decisão 2026-09-30).
  function clickLinkIsUsable(url) {
    const click = parseAwinClickUrl(url)
    if (!click) return false
    if (click.publisherId && ownPublishers.has(click.publisherId)) return true
    if (click.advertiserId && byAdvertiser.has(click.advertiserId)) return true
    return Boolean(click.destinationUrl && storeForUrl(click.destinationUrl))
  }

  return {
    size: byAdvertiser.size,
    storeForUrl,
    storeForAdvertiser: (advertiserId) => byAdvertiser.get(Number(advertiserId)) || null,
    // Detector: link de loja aprovada, link de clique da Awin de loja aprovada
    // (ou já dela), ou tidd.ly — este só se sabe abrindo; o robô abre antes do
    // sanitizador (conversionContext.refineAwinOptionsForText).
    isAwinLink: (url) => {
      if (isAwinShortUrl(url)) return true
      if (isAwinTrackingUrl(url)) return clickLinkIsUsable(url)
      return Boolean(storeForUrl(url))
    },
  }
}
