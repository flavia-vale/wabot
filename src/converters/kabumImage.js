// Foto de produto da KaBuM (loja da Awin) sem depender da página do site.
//
// RCA 2026-09-30 (docs/rca/afiliados-awin.md): 51 promoções da KaBuM nas
// ofertas automáticas saíram SEM foto — a leitura da página
// (`kabum.com.br/produto/<id>`, og:image) falhou no servidor, e as mesmas
// páginas devolvem a foto fora dele. A KaBuM publica os dados do produto numa
// consulta pública separada do site, que já traz as fotos:
//   GET https://servicespub.prod.api.aws.grupokabum.com.br/descricao/v1/descricao/produto/<id>
//   → { sucesso: true, fotos: ["https://images8.kabum.com.br/.../<nome>_g.jpg", ...] }
//   (produto inexistente → { sucesso: false })
// Medido em 2026-09-30: fotos `_m` = 200px, `_g` = 395px, `_gg` = 1000px;
// marketplace (`sync_mirakl`) `/medium/` = 200px, `/large/` = 400px,
// `/xlarge/` = 1000px.

export const KABUM_PRODUCT_API = 'https://servicespub.prod.api.aws.grupokabum.com.br/descricao/v1/descricao/produto/'
const KABUM_HOST_RE = /(^|\.)kabum\.com\.br$/i
const KABUM_IMAGE_HOST_RE = /^images\d*\.kabum\.com\.br$/i
const API_TIMEOUT_MS = 6_000

function hostOf(url) {
  try { return new URL(String(url ?? '')).hostname.toLowerCase() } catch { return '' }
}

/** kabum.com.br/produto/931218/slug → "931218". PURA. */
export function kabumProductId(url) {
  if (!KABUM_HOST_RE.test(hostOf(url))) return null
  try {
    const match = new URL(url).pathname.match(/^\/produto\/(\d{3,12})(?:\/|$)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function isKabumImageUrl(url) {
  return KABUM_IMAGE_HOST_RE.test(hostOf(url))
}

/**
 * Variantes da mesma foto, da maior para a menor, terminando na original.
 * PURA. Nunca inventa arquivo: só troca o sufixo/pasta de tamanho.
 */
export function buildKabumImageUrlCandidates(url) {
  const raw = String(url ?? '')
  const out = []
  const sufixo = raw.match(/^(.*_\d+)_(m|g|p)\.(jpe?g|png|webp)(\?.*)?$/i)
  if (sufixo) out.push(`${sufixo[1]}_gg.${sufixo[3]}${sufixo[4] || ''}`)
  if (/\/(?:small|medium|large)\//i.test(raw)) out.push(raw.replace(/\/(?:small|medium|large)\//i, '/xlarge/'))
  out.push(raw)
  return [...new Set(out)]
}

/** Primeira foto do produto pela consulta pública da KaBuM, ou null. */
export async function fetchKabumApiImage(productUrl, { fetchFn = globalThis.fetch, timeoutMs = API_TIMEOUT_MS } = {}) {
  const id = kabumProductId(productUrl)
  if (!id) return null
  try {
    const response = await fetchFn(`${KABUM_PRODUCT_API}${id}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response?.ok) return null
    const body = await response.json()
    if (!body || body.sucesso === false) return null
    const photo = (Array.isArray(body.fotos) ? body.fotos : []).find((item) => typeof item === 'string' && isKabumImageUrl(item))
    return photo || null
  } catch {
    return null
  }
}
