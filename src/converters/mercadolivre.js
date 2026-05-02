import axios from 'axios'

// Captura apenas o Location do redirect meli.la sem seguir até o ML
// (evita fingerprinting do ML que bloqueia requests de bot)
async function resolve(url) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 0,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      validateStatus: () => true,
    })
    if (res.status >= 300 && res.status < 400 && res.headers?.location) {
      const next = new URL(res.headers.location, url).toString()
      // Se ainda for short URL, seguir mais um passo
      if (/meli\.la|mluvem\.com/.test(next)) return resolve(next)
      return next
    }
    return url
  } catch {
    return url
  }
}

export async function convert(url, creds) {
  const { tag } = creds
  try {
    let target = url

    // Resolver short URLs
    if (/meli\.la|mluvem\.com/.test(url)) {
      target = await resolve(url)
    }

    const u = new URL(target)

    // Garantir que é domínio ML real
    if (!u.hostname.includes('mercadolivre') && !u.hostname.includes('mercadolibre')) {
      return null
    }

    // Remove parâmetros de afiliado do remetente original
    for (const p of ['matt_word', 'matt_tool', 'forceInApp', 'ref', 'partner_id']) {
      u.searchParams.delete(p)
    }
    u.searchParams.set('partner_id', tag)
    return u.toString()
  } catch {
    return null
  }
}
