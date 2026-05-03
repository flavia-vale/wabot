import axios from 'axios'

// Captura o Location do redirect meli.la sem seguir até o ML
// (follow-redirects lança erro na 3xx — Location fica em err.response.headers)
async function resolve(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
    if (res?.url && res.url !== url) return res.url
  } catch {
    // fallback para resolução manual abaixo
  }

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
  if (u.pathname === '/gz/webdevice/config') {
    const go = u.searchParams.get('go')
    if (go) return canonicalizeMlProductUrl(go)
  }
  u.hash = ''
  for (const p of ['matt_word', 'matt_tool', 'forceInApp', 'ref', 'partner_id', 'reco_backend', 'reco_client', 'reco_item_pos', 'reco_backend_type', 'reco_id', 'sid', 'c_id', 'c_uid', 'polycard_client']) {
    u.searchParams.delete(p)
  }
  return u.toString()
}

function extractMlbId(input) {
  if (!input) return null
  const m = String(input).match(/\bMLB[-_]?([0-9]{6,})\b/i)
  if (!m) return null
  return `MLB${m[1]}`
}

function buildCanonicalCandidates(targetUrl) {
  const id = extractMlbId(targetUrl)
  if (!id) return [targetUrl]
  const candidates = [
    targetUrl,
    `https://www.mercadolivre.com.br/p/${id}`,
    `https://produto.mercadolivre.com.br/${id}-x-_JM`,
  ]
  return [...new Set(candidates)]
}

async function tryExtractProductFromLanding(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = typeof res?.data === 'string' ? res.data : ''
    const patterns = [
      /https?:\/\/www\.mercadolivre\.com\.br\/p\/MLB[0-9]{6,}/i,
      /https?:\/\/produto\.mercadolivre\.com\.br\/MLB[-_][0-9]{6,}[^"'\\\s<]*/i,
      /https?:\\\/\\\/www\.mercadolivre\.com\.br\\\/p\\\/MLB[0-9]{6,}/i,
      /https?:\\\/\\\/produto\.mercadolivre\.com\.br\\\/MLB[-_][0-9]{6,}[^"'\\\s<]*/i,
    ]
    for (const p of patterns) {
      const found = html.match(p)?.[0]
      if (!found) continue
      const normalized = found.replace(/\\\//g, '/')
      return canonicalizeMlProductUrl(normalized)
    }
    return null
  } catch {
    return null
  }
}

async function tryExtractProductFromLanding(url) {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = typeof res?.data === 'string' ? res.data : ''
    const patterns = [
      /https?:\/\/www\.mercadolivre\.com\.br\/p\/MLB[0-9]{6,}/i,
      /https?:\/\/produto\.mercadolivre\.com\.br\/MLB[-_][0-9]{6,}[^"'\\\s<]*/i,
      /https?:\\\/\\\/www\.mercadolivre\.com\.br\\\/p\\\/MLB[0-9]{6,}/i,
      /https?:\\\/\\\/produto\.mercadolivre\.com\.br\\\/MLB[-_][0-9]{6,}[^"'\\\s<]*/i,
    ]
    for (const p of patterns) {
      const found = html.match(p)?.[0]
      if (!found) continue
      const normalized = found.replace(/\\\//g, '/')
      return canonicalizeMlProductUrl(normalized)
    }
    return null
  } catch {
    return null
  }
}

// Chama a API real de afiliados do ML para gerar um meli.la com a tag do usuário
// Endpoint descoberto via reverse-engineering do portal afiliados.mercadolivre.com.br
function buildCookieHeader({ ssid, csrf, cookie, id }) {
  if (cookie) return cookie
  const pairs = []
  if (id) pairs.push(`id=${id}`)
  if (csrf) pairs.push(`_csrf=${csrf}`)
  if (ssid) pairs.push(`ssid=${ssid}`)
  return pairs.join('; ')
}

async function createAffiliateLink(mlUrl, tag, creds) {
  const { ssid, csrf, cookie, id } = creds
  const cookieHeader = buildCookieHeader({ ssid, csrf, cookie, id })
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


async function validateAffiliateRedirect(affiliateUrl, expectedMlbId) {
  if (!affiliateUrl || !expectedMlbId) return false
  try {
    const resolved = await resolve(affiliateUrl)
    const finalId = extractMlbId(resolved)
    return finalId === expectedMlbId
  } catch {
    return false
  }
}

const ML_HOST = /mercadolivre|mercadolibre|meli\.la|mluvem\.com/

export async function resolveToCleanProductUrl(url) {
  try {
    if (!ML_HOST.test(new URL(url).hostname)) return null

    let target = url
    if (/meli\.la|mluvem\.com/.test(url)) {
      target = await resolve(url)
    }

    target = canonicalizeMlProductUrl(target)
    if (!extractMlbId(target)) {
      const u = new URL(target)
      if (/^\/social\//i.test(u.pathname)) {
        const extracted = await tryExtractProductFromLanding(target)
        if (extracted) target = extracted
      }
    }
    return target
  } catch {
    return null
  }
}

export async function convert(url, creds) {
  const { tag, ssid, resolveOnly } = creds
  try {
    // Checar domínio ML antes de qualquer coisa
    if (!ML_HOST.test(new URL(url).hostname)) return null

    const cleanTarget = await resolveToCleanProductUrl(url)
    if (!cleanTarget) return null
    if (resolveOnly) return cleanTarget
    const target = cleanTarget
    const candidates = buildCanonicalCandidates(target)

    // Gerar link de afiliado real via API (retorna novo meli.la com a tag do usuário)
    if (ssid) {
      for (const candidate of candidates) {
        try {
          const affiliateUrl = await createAffiliateLink(candidate, tag, creds)
          if (!affiliateUrl) continue
          const expectedMlbId = extractMlbId(candidate) || extractMlbId(target)
          if (!expectedMlbId || await validateAffiliateRedirect(affiliateUrl, expectedMlbId)) {
            return affiliateUrl
          }
        } catch {
          // tenta próximo candidato
        }
      }

      // Segunda tentativa em formato canônico mínimo (remove query inteira)
      try {
        const clean = new URL(candidates[0] ?? target)
        clean.search = ''
        const affiliateUrl = await createAffiliateLink(clean.toString(), tag, creds)
        if (!affiliateUrl) {
          // tenta próximo fallback
        } else {
          const expectedMlbId = extractMlbId(clean.toString()) || extractMlbId(target)
          if (!expectedMlbId || await validateAffiliateRedirect(affiliateUrl, expectedMlbId)) {
            return affiliateUrl
          }
        }
      } catch {
        // cai no fallback
      }

      // Segunda tentativa em formato canônico mínimo (remove query inteira)
      try {
        const clean = new URL(target)
        clean.search = ''
        const affiliateUrl = await createAffiliateLink(clean.toString(), tag, creds)
        if (!affiliateUrl) {
          // tenta próximo fallback
        } else {
          const expectedMlbId = extractMlbId(clean.toString()) || extractMlbId(target)
          if (!expectedMlbId || await validateAffiliateRedirect(affiliateUrl, expectedMlbId)) {
            return affiliateUrl
          }
        }
      } catch {
        // cai no fallback
      }
    }

    let fallbackTarget = target
    const fallbackId = extractMlbId(target)
    if (fallbackId) {
      const parsed = new URL(target)
      if (/^\/p\/MLB/i.test(parsed.pathname)) {
        fallbackTarget = `https://produto.mercadolivre.com.br/${fallbackId}-x-_JM`
      }
    }
    const u = new URL(fallbackTarget)

    // Fallback: injetar partner_id na URL resolvida (ou na meli.la original se resolve falhou)
    for (const p of ['matt_word', 'matt_tool', 'forceInApp', 'ref', 'partner_id']) {
      u.searchParams.delete(p)
    }
    if (tag) u.searchParams.set('partner_id', tag)
    return u.toString()
  } catch {
    return null
  }
}
