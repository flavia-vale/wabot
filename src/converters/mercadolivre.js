import axios from 'axios'

// Captura o Location do redirect meli.la sem seguir até o ML
// (follow-redirects lança erro na 3xx — Location fica em err.response.headers)
async function resolve(url) {
  try {
    await axios.get(url, {
      maxRedirects: 0,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return url
  } catch (err) {
    const location = err?.response?.headers?.location
    if (location) {
      const next = new URL(location, url).toString()
      if (/meli\.la|mluvem\.com/.test(next)) return resolve(next)
      return next
    }
    return url
  }
}

// Chama a API real de afiliados do ML para gerar um meli.la com a tag do usuário
// Endpoint descoberto via reverse-engineering do portal afiliados.mercadolivre.com.br
async function createAffiliateLink(mlUrl, tag, ssid) {
  const res = await axios.post(
    'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
    { urls: [mlUrl], tag },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `ssid=${ssid}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'Origin': 'https://www.mercadolivre.com.br',
      },
      timeout: 10000,
    }
  )
  const result = res.data?.urls?.[0]
  if (result?.created && result?.short_url) return result.short_url
  return null
}

export async function convert(url, creds) {
  const { tag, ssid } = creds
  try {
    let target = url

    // Resolver short URLs para obter a URL real do produto ML
    if (/meli\.la|mluvem\.com/.test(url)) {
      target = await resolve(url)
    }

    const u = new URL(target)

    // Garantir que é domínio ML real
    if (!u.hostname.includes('mercadolivre') && !u.hostname.includes('mercadolibre')) {
      return null
    }

    // Gerar link de afiliado real via API (retorna novo meli.la com a tag do usuário)
    if (ssid) {
      try {
        const affiliateUrl = await createAffiliateLink(target, tag, ssid)
        if (affiliateUrl) return affiliateUrl
      } catch {
        // Se a API falhar, cai no fallback abaixo
      }
    }

    // Fallback: injetar partner_id na URL ML resolvida
    for (const p of ['matt_word', 'matt_tool', 'forceInApp', 'ref', 'partner_id']) {
      u.searchParams.delete(p)
    }
    u.searchParams.set('partner_id', tag)
    return u.toString()
  } catch {
    return null
  }
}
