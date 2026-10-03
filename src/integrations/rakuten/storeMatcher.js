// Lojas da Rakuten no link: de qual loja aprovada é esta URL? Funções PURAS —
// sem rede, sem banco, sem relógio. Usadas pelo espelhamento, pelo "Converter
// links" e pelo "Criar oferta" (mesmo desenho de src/integrations/awin/
// storeMatcher.js).
//
// Link de afiliado da Rakuten (formato público de deep link):
// https://click.linksynergy.com/deeplink?id=<ID da cliente>&mid=<loja>&murl=<página>
// Medido em 2026-09-30 (feed de ofertas): o `clickurl` das promoções é
// click.linksynergy.com/fs-bin/click?id=<ID da cliente>&offerid=... — o `id` é
// o mesmo em todos os links da conta. ⚠️ Hipótese a medir na VPS
// (scripts/diag-rakuten.mjs --rakuten): o `id` do deep link é esse mesmo.
//
// NUNCA abrir um link da Rakuten para descobrir a loja: diferente do tidd.ly
// da Awin, o próprio click.linksynergy.com já conta o clique e redireciona
// para a loja (clique falso vindo da VPS — docs/rca/afiliados-rakuten.md).
// Link sem `murl` (fs-bin/click de outra pessoa) = destino desconhecido →
// não serve → o sanitizador apaga o link e o resto da oferta segue.

import { isOfferUrl } from '../../detector.js'
import { cleanDestinationUrl as cleanAwinDestinationUrl, normalizeStoreDomain as normalizeAwinStoreDomain } from '../awin/storeMatcher.js'

export const RAKUTEN_CLICK_HOSTS = ['linksynergy.com']
const MAX_DOMAINS_PER_STORE = 30
const LINK_ID_RE = /^[A-Za-z0-9*/_+.-]{4,64}$/

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

/** Domínio de loja ("https://www.netshoes.com.br/" → "netshoes.com.br"); nunca a própria Rakuten. */
export function normalizeRakutenStoreDomain(value) {
  const domain = normalizeAwinStoreDomain(value)
  if (!domain || hostIn(domain, RAKUTEN_CLICK_HOSTS)) return null
  return domain
}

export function isRakutenTrackingUrl(url) {
  return hostIn(hostOf(url), RAKUTEN_CLICK_HOSTS)
}

export function isValidRakutenLinkId(value) {
  return LINK_ID_RE.test(String(value ?? ''))
}

/**
 * click.linksynergy.com/...?id=&mid=&murl= → { linkId, advertiserId,
 * destinationUrl }. `RD_PARM1` é o nome antigo do `murl`. null se não for
 * link da Rakuten.
 */
export function parseRakutenClickUrl(url) {
  if (!isRakutenTrackingUrl(url)) return null
  let params
  try {
    params = new URL(url).searchParams
  } catch {
    return null
  }
  const linkId = String(params.get('id') ?? '').trim()
  const advertiserId = String(params.get('mid') ?? '').trim()
  const destination = params.get('murl') || params.get('RD_PARM1') || null
  return {
    linkId: isValidRakutenLinkId(linkId) ? linkId : null,
    advertiserId: /^\d{1,12}$/.test(advertiserId) ? advertiserId : null,
    destinationUrl: hostOf(destination) ? destination : null,
  }
}

/** `id` da cliente tirado de um link da Rakuten dela (o `clickurl` das promoções). */
export function extractRakutenLinkId(clickUrl) {
  return parseRakutenClickUrl(clickUrl)?.linkId ?? null
}

// A loja acrescenta estes parâmetros na página depois do clique (ranSiteID =
// o site de QUEM clicou): saem antes de montar o link, senão o site do
// concorrente vai junto e cada variação vira um link diferente.
const RAKUTEN_PARAM_RE = /^(?:ranmid|raneaid|ransiteid|siteid|lsnsubsite|lsnsiteid)$/i

export function cleanRakutenDestinationUrl(url) {
  const cleaned = cleanAwinDestinationUrl(url)
  if (!cleaned) return null
  const parsed = new URL(cleaned)
  for (const key of [...parsed.searchParams.keys()]) {
    if (RAKUTEN_PARAM_RE.test(key)) parsed.searchParams.delete(key)
  }
  return parsed.toString()
}

/** Deep link documentado — montado aqui, sem chamada à Rakuten. */
export function buildRakutenDeepLink({ linkId, advertiserId, destinationUrl }) {
  const url = new URL('https://click.linksynergy.com/deeplink')
  url.searchParams.set('id', String(linkId))
  url.searchParams.set('mid', String(advertiserId))
  url.searchParams.set('murl', String(destinationUrl))
  return url.toString()
}

/**
 * Resposta XML de /linklocator/1.0/getMerchByAppStatus/approved → [{ advertiserId,
 * name }]. Formato documentado (⚠️ a medir): <ns1:return> com <ns1:mid> e
 * <ns1:name> por loja. null = resposta que não parece a lista (não apaga nada).
 */
export function extractApprovedMerchants(xml) {
  const text = String(xml ?? '')
  if (!/getMerchByAppStatusResponse/i.test(text)) return null
  const blocks = []
  const re = /<(?:[\w-]+:)?return(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?return>/gi
  for (let match = re.exec(text); match; match = re.exec(text)) blocks.push(match[1])
  const tag = (block, name) => {
    const found = new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i').exec(block)
    return found ? found[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').trim() : ''
  }
  const seen = new Set()
  const out = []
  for (const block of blocks) {
    const advertiserId = tag(block, 'mid')
    if (!/^\d{1,12}$/.test(advertiserId) || seen.has(advertiserId)) continue
    seen.add(advertiserId)
    out.push({ advertiserId, name: tag(block, 'name').slice(0, 200) || `Loja ${advertiserId}` })
  }
  return out
}

/** Domínios da loja a partir do site dela (`/v2/advertisers/{id}` → url). */
export function storeDomainsFromUrl(storeUrl) {
  const domain = normalizeRakutenStoreDomain(storeUrl)
  return domain ? [domain].slice(0, MAX_DOMAINS_PER_STORE) : []
}

/**
 * Lojas aprovadas da cliente → "de qual loja é esta URL?". `stores` =
 * [{ accountId, linkId, advertiserId, name, domains }]. A mesma loja em duas
 * contas: vale a primeira da lista (quem monta decide a ordem).
 */
export function createRakutenStoreMatcher(stores = [], { linkIds = [] } = {}) {
  const ownLinkIds = new Set([...linkIds].filter(Boolean).map(String))
  const byDomain = new Map()
  const byAdvertiser = new Map()
  for (const store of stores) {
    if (!store?.advertiserId) continue
    const advertiserId = String(store.advertiserId)
    if (!byAdvertiser.has(advertiserId)) byAdvertiser.set(advertiserId, store)
    for (const domain of store.domains || []) {
      if (!byDomain.has(domain)) byDomain.set(domain, store)
    }
  }
  const domainsLongestFirst = [...byDomain.keys()].sort((a, b) => b.length - a.length)

  function storeForUrl(url) {
    const host = hostOf(url)
    if (!host || hostIn(host, RAKUTEN_CLICK_HOSTS)) return null
    for (const domain of domainsLongestFirst) {
      if (host === domain || host.endsWith(`.${domain}`)) return byDomain.get(domain)
    }
    return null
  }

  function storeForAdvertiser(advertiserId) {
    return byAdvertiser.get(String(advertiserId ?? '')) || null
  }

  // A página pode ser desta loja? Domínio desconhecido segue pela loja do
  // `mid` — guardamos só o site principal de cada loja, e a Rakuten confere o
  // domínio no clique (decisão de 2026-10-01). Só a página de uma loja FIXA
  // (Shopee, ML, Amazon, Magalu, SHEIN, AliExpress) nunca serve: `mid` da
  // Netshoes com `murl` da Amazon virava um link nosso quebrado e o link da
  // Amazon, que converteríamos, se perdia (revisão 2026-10-03, R6).
  function destinationFitsStore(store, url) {
    if (!store) return false
    return !isOfferUrl(String(url ?? ''))
  }

  // Loja de um link da Rakuten (ou página): pela página primeiro; pelo `mid`
  // só quando a página é dessa mesma loja.
  function storeForClick({ advertiserId, destinationUrl }) {
    const byPage = destinationUrl ? storeForUrl(destinationUrl) : null
    if (byPage) return byPage
    const byMid = advertiserId ? storeForAdvertiser(advertiserId) : null
    return byMid && (!destinationUrl || destinationFitsStore(byMid, destinationUrl)) ? byMid : null
  }

  // Link da Rakuten: dá para saber SEM rede se serve. Já é dela → fica. De
  // outra pessoa → só com a página de destino (`murl`) E de loja aprovada.
  function clickLinkIsUsable(url) {
    const click = parseRakutenClickUrl(url)
    if (!click) return false
    if (click.linkId && ownLinkIds.has(click.linkId)) return true
    if (!click.destinationUrl) return false
    return Boolean(storeForClick(click))
  }

  return {
    size: byAdvertiser.size,
    ownLinkIds,
    storeForUrl,
    storeForAdvertiser,
    storeForClick,
    isRakutenLink: (url) => (isRakutenTrackingUrl(url) ? clickLinkIsUsable(url) : Boolean(storeForUrl(url))),
  }
}
