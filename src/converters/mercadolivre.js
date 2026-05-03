import axios from 'axios'

// Captura o Location do redirect meli.la sem seguir até o ML
// (follow-redirects lança erro na 3xx — Location fica em err.response.headers)
async function resolve(url) {
  let current = url
  for (let i = 0; i < 8; i++) {
    try {
      const res = await axios.get(current, {
        maxRedirects: 0,
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })

      // Alguns meli.la retornam 200 com HTML intermediário (sem 3xx).
      // Tentar extrair URL final via meta refresh / canonical / location.href.
      const html = typeof res?.data === 'string' ? res.data : ''
      const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)["']/i)?.[1]
      const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
      const jsLocation = html.match(/(?:window\.)?location\.(?:href|replace)\s*=\s*["']([^"']+)["']/i)?.[1]
      const encodedOriginUrl = html.match(/"origin_url"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i)?.[1]
      const originUrl = encodedOriginUrl
        ? JSON.parse(`"${encodedOriginUrl}"`)
        : null
      const nextFromHtml = originUrl || metaRefresh || canonical || jsLocation
      if (!nextFromHtml) return current

      const next = new URL(nextFromHtml, current).toString()
      if (next === current) return current
      current = next
      continue
    } catch (err) {
      const location = err?.response?.headers?.location
      if (!location) return current
      current = new URL(location, current).toString()
    }
  }
  return current
}

function canonicalizeMlProductUrl(raw) {
  const u = new URL(raw)
  u.hash = ''
  for (const p of ['matt_word', 'matt_tool', 'forceInApp', 'ref', 'partner_id', 'reco_backend', 'reco_client', 'reco_item_pos', 'reco_backend_type', 'reco_id', 'sid', 'c_id', 'c_uid', 'polycard_client']) {
    u.searchParams.delete(p)
  }
  return u.toString()
}

// Chama a API real de afiliados do ML para gerar um meli.la com a tag do usuário
// Endpoint descoberto via reverse-engineering do portal afiliados.mercadolivre.com.br
function buildCookieHeader({ ssid, csrf, cookie }) {
  if (cookie) return cookie
  const pairs = []
  if (csrf) pairs.push(`_csrf=${csrf}`)
  if (ssid) pairs.push(`ssid=${ssid}`)
  return pairs.join('; ')
}

async function createAffiliateLink(mlUrl, tag, creds) {
  const { ssid, csrf, cookie } = creds
  const cookieHeader = buildCookieHeader({ ssid, csrf, cookie })
  const res = await axios.post(
    'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
    { urls: [mlUrl], tag },
    {
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'Origin': 'https://www.mercadolivre.com.br',
      },
      timeout: 10000,
    }
  )
  const result = res.data?.urls?.[0]
  if (result?.short_url) return result.short_url
  return null
}

const ML_HOST = /mercadolivre|mercadolibre|meli\.la|mluvem\.com/

export async function convert(url, creds) {
  const { tag, ssid } = creds
  try {
    // Checar domínio ML antes de qualquer coisa
    if (!ML_HOST.test(new URL(url).hostname)) return null

    let target = url

    // Resolver short URLs para obter a URL real do produto ML
    if (/meli\.la|mluvem\.com/.test(url)) {
      target = await resolve(url)
    }

    target = canonicalizeMlProductUrl(target)

    // Gerar link de afiliado real via API (retorna novo meli.la com a tag do usuário)
    if (ssid) {
      try {
        const affiliateUrl = await createAffiliateLink(target, tag, creds)
        if (affiliateUrl) return affiliateUrl
      } catch {
        // Se a API falhar, cai no fallback abaixo
      }

      // Segunda tentativa em formato canônico mínimo (remove query inteira)
      try {
        const clean = new URL(target)
        clean.search = ''
        const affiliateUrl = await createAffiliateLink(clean.toString(), tag, creds)
        if (affiliateUrl) return affiliateUrl
      } catch {
        // cai no fallback
      }
    }

    const u = new URL(target)

    // Fallback: injetar partner_id na URL resolvida (ou na meli.la original se resolve falhou)
    for (const p of ['matt_word', 'matt_tool', 'forceInApp', 'ref', 'partner_id']) {
      u.searchParams.delete(p)
    }
    u.searchParams.set('partner_id', tag)
    return u.toString()
  } catch {
    return null
  }
}
