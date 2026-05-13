import axios from 'axios'
import logger from '../logger.js'

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
  const normalizedRaw = String(raw).replace(/&amp;/gi, '&')
  const u = new URL(normalizedRaw)
  if (u.pathname === '/gz/webdevice/config') {
    const go = u.searchParams.get('go')
    if (go) return canonicalizeMlProductUrl(go)
  }
  u.hash = ''
  const removableParams = new Set([
    'matt_word', 'matt_tool', 'matt_event_ts', 'matt_d2id', 'matt_tracing_id',
    'forceInApp', 'ref', 'partner_id',
    'reco_backend', 'reco_client', 'reco_item_pos', 'reco_backend_type', 'reco_id',
    'sid', 'c_id', 'c_uid', 'polycard_client',
  ])
  for (const key of [...u.searchParams.keys()]) {
    const normalizedKey = key.replace(/^amp;/i, '')
    if (normalizedKey !== key) {
      const values = u.searchParams.getAll(key)
      u.searchParams.delete(key)
      for (const value of values) u.searchParams.append(normalizedKey, value)
    }
  }
  for (const p of removableParams) {
    u.searchParams.delete(p)
    u.searchParams.delete(`amp;${p}`)
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

    // Primeiro: tags que apontam para o produto da PRÓPRIA página
    // (canonical, og:url, twitter:url). Evita pegar MLB de carrossel
    // de recomendações que aparece antes do link real no HTML.
    const anchored = [
      html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1],
      html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1],
      html.match(/<meta[^>]*name=["']twitter:url["'][^>]*content=["']([^"']+)["']/i)?.[1],
    ]
    for (const candidate of anchored) {
      if (!candidate) continue
      if (!extractMlbId(candidate)) continue
      try { return canonicalizeMlProductUrl(candidate) } catch { /* ignore */ }
    }

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

async function callCreateLinkApi(mlUrl, tag, { cookieHeader, csrf }) {
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
      validateStatus: () => true,
    }
  )
  return res
}

async function createAffiliateLink(mlUrl, tag, creds) {
  const { ssid, csrf, cookie, id } = creds

  if (!ssid && !cookie) {
    logger.warn({ ssid, cookie, id }, 'ML createLink: ssid vazio, pulando chamada API')
    return null
  }

  // Tenta primeiro sem csrf — alguns fluxos do ML aceitam só com ssid
  const attempts = []
  attempts.push({ cookieHeader: buildCookieHeader({ ssid, cookie, id }), csrf: null, label: 'no-csrf' })
  if (csrf) {
    attempts.push({ cookieHeader: buildCookieHeader({ ssid, csrf, cookie, id }), csrf, label: 'with-csrf' })
  }

  let lastError = null
  for (const attempt of attempts) {
    try {
      logger.info({ attempt: attempt.label, mlUrl, hasSsid: !!ssid, hasCsrf: !!csrf }, 'ML createLink: tentando chamada API')
      const res = await callCreateLinkApi(mlUrl, tag, attempt)
      const result = res.data?.urls?.[0]
      if (result?.short_url) {
        logger.info({ attempt: attempt.label, mlUrl }, 'ML createLink: short_url gerado')
        return result.short_url
      }
      lastError = {
        status: res.status,
        attempt: attempt.label,
        apiError: result?.error || result?.message || res.data?.error || res.data?.message,
        urls: res.data?.urls,
        rawBody: typeof res.data === 'string' ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500),
        responseHeaders: { 'content-type': res.headers?.['content-type'], 'set-cookie': res.headers?.['set-cookie']?.length },
      }
      logger.warn(lastError, 'ML createLink: API respondeu sem short_url')
    } catch (err) {
      lastError = { attempt: attempt.label, err: err.message, status: err.response?.status }
      logger.warn(lastError, 'ML createLink: erro ao chamar API')
    }
  }

  return null
}


async function validateAffiliateRedirect(affiliateUrl, expectedMlbId) {
  if (!affiliateUrl || !expectedMlbId) return false
  try {
    const resolved = await resolve(affiliateUrl)
    // Tentar extrair MLB direto da URL final (cobre URLs de produto e
    // também /social/...?go=...MLB123... porque o regex pega dentro de
    // qualquer parte da string).
    let finalId = extractMlbId(resolved)
    if (!finalId) {
      // Aplica canonicalização (resolve /gz/webdevice/config?go=, etc).
      try {
        const canon = canonicalizeMlProductUrl(resolved)
        finalId = extractMlbId(canon)
      } catch { /* ignore */ }
    }
    if (!finalId) {
      // Última tentativa: extrair do HTML da landing (canonical/og:url).
      const fromLanding = await tryExtractProductFromLanding(resolved)
      if (fromLanding) finalId = extractMlbId(fromLanding)
    }
    if (finalId === expectedMlbId) return true
    logger.warn({ affiliateUrl, resolved, finalId, expectedMlbId }, 'ML validate: short_url resolveu para MLB diferente do esperado')
    return false
  } catch (err) {
    logger.warn({ affiliateUrl, expectedMlbId, err: err.message }, 'ML validate: erro ao resolver short_url')
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

    // Âncora: MLB esperado é o do target resolvido (não do candidate enviado à API).
    // Sem essa âncora, se um candidate vier com MLB errado a validação compararia
    // errado-com-errado e passaria.
    const anchorMlbId = extractMlbId(target)

    // Gerar link de afiliado real via API (retorna novo meli.la com a tag do usuário)
    if (ssid) {
      const tries = [...candidates]
      try {
        const clean = new URL(candidates[0] ?? target)
        clean.search = ''
        tries.push(clean.toString())
      } catch {}
      try {
        const clean = new URL(target)
        clean.search = ''
        tries.push(clean.toString())
      } catch {}

      const seen = new Set()
      for (const candidate of tries) {
        if (seen.has(candidate)) continue
        seen.add(candidate)
        // Não enviar para a API um candidate que já diverge do MLB esperado
        if (anchorMlbId) {
          const candidateMlbId = extractMlbId(candidate)
          if (candidateMlbId && candidateMlbId !== anchorMlbId) {
            logger.warn({ candidate, anchorMlbId, candidateMlbId }, 'ML createLink: candidate diverge do MLB esperado — pulando')
            continue
          }
        }
        try {
          const affiliateUrl = await createAffiliateLink(candidate, tag, creds)
          if (!affiliateUrl) continue
          if (anchorMlbId) {
            const valid = await validateAffiliateRedirect(affiliateUrl, anchorMlbId)
            if (!valid) {
              logger.warn({ affiliateUrl, anchorMlbId, candidate }, 'ML createLink: short_url resolveu para produto diferente — descartando')
              continue
            }
          }
          return affiliateUrl
        } catch (err) {
          logger.warn({ candidate, err: err.message }, 'ML createLink: tentativa falhou')
        }
      }

      logger.warn({ url, target }, 'ML createLink: todas as tentativas falharam — usando fallback partner_id')
      // Cai no fallback partner_id abaixo (preserva ao menos o MLB correto)
    }

    let fallbackTarget = target
    const fallbackId = extractMlbId(target)
    if (fallbackId) {
      const parsed = new URL(target)
      if (/^\/p\/MLB/i.test(parsed.pathname)) {
        fallbackTarget = `https://produto.mercadolivre.com.br/${fallbackId}-x-_JM`
      }
    }
    const u = new URL(canonicalizeMlProductUrl(fallbackTarget))

    // Fallback: injetar partner_id na URL resolvida (ou na meli.la original se resolve falhou)
    u.searchParams.delete('partner_id')
    if (tag) u.searchParams.set('partner_id', tag)
    return u.toString()
  } catch {
    return null
  }
}
