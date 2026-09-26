/* De QUEM era o link colado na tela "Testar conversão" — depois da conversão.
 *
 * `ownAffiliateLink.js` só enxerga a identificação quando ela está escrita na
 * URL colada (ex.: `?tag=` da Amazon). Link curto (meli.la, s.shopee.com.br,
 * amzn.divulgador.link…) esconde a identificação, e a tela dizia "Esse link
 * não era seu" para link que ERA da cliente (caso real 2026-09-26: meli.la e
 * s.shopee dela mesma). Aqui a resposta usa o que a conversão já descobriu:
 *
 * - convertido === colado → o link já era dela (o ML devolve o mesmo meli.la
 *   para a mesma etiqueta e produto);
 * - identificação do link colado (já resolvido) comparada com a dela:
 *   Amazon `tag`, ML/Magalu `partner_id`, Shopee `an_<id>` no destino do link.
 *   Na Shopee a credencial não guarda o ID de afiliada (o App ID é outro
 *   número — ver scripts/diag-shopee-chave.mjs), então o dela vem do destino
 *   do link que a própria conversão acabou de gerar.
 *
 * Sem dado para comparar → `desconhecido`. A tela não afirma nada nesse caso.
 */

export const DONO_DO_LINK = Object.freeze({
  PROPRIO: 'own',
  OUTRO: 'foreign',
  DESCONHECIDO: 'unknown',
})

function paramOf(url, name) {
  try {
    const value = new URL(String(url)).searchParams.get(name)
    return value ? value.trim() : null
  } catch {
    return null
  }
}

function shopeeAffiliateId(url) {
  const fromParam = paramOf(url, 'utm_source') || paramOf(url, 'mmp_pid')
  const direct = fromParam && /^an_(\d{6,})$/.exec(fromParam)
  if (direct) return direct[1]
  let text = String(url || '')
  for (let round = 0; round < 3; round++) {
    const m = /[?&]utm_source=an_(\d{6,})/.exec(text)
    if (m) return m[1]
    let decoded
    try { decoded = decodeURIComponent(text) } catch { break }
    if (decoded === text) break
    text = decoded
  }
  return null
}

/** Identificação de afiliado que a URL carrega, ou null. */
export function affiliateIdFromUrl(platform, url) {
  if (!url) return null
  if (platform === 'amazon') return paramOf(url, 'tag')
  if (platform === 'mercadolivre' || platform === 'magazineluiza') return paramOf(url, 'partner_id')
  if (platform === 'shopee') return shopeeAffiliateId(url)
  return null
}

function sameLink(a, b) {
  const norm = (value) => {
    try {
      const u = new URL(String(value))
      return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`
    } catch {
      return String(value || '').trim()
    }
  }
  return Boolean(a && b) && norm(a) === norm(b)
}

/**
 * Regra pura.
 * @param {{platform: string, originalUrl: string, convertedUrl: string, sourceUrl?: string|null, convertedTargetUrl?: string|null, creds?: object}} p
 *   sourceUrl: destino do link colado (resolvido pela conversão);
 *   convertedTargetUrl: destino do link convertido (usado na Shopee).
 */
export function judgePastedLinkOwnership({ platform, originalUrl, convertedUrl, sourceUrl = null, convertedTargetUrl = null, creds = {} } = {}) {
  if (sameLink(originalUrl, convertedUrl)) return DONO_DO_LINK.PROPRIO

  const dela = platform === 'shopee'
    ? affiliateIdFromUrl('shopee', convertedTargetUrl)
    : String(creds?.tag ?? '').trim() || null
  const doLink = affiliateIdFromUrl(platform, sourceUrl) || affiliateIdFromUrl(platform, originalUrl)

  if (!dela || !doLink) return DONO_DO_LINK.DESCONHECIDO
  return doLink === dela ? DONO_DO_LINK.PROPRIO : DONO_DO_LINK.OUTRO
}
