import axios from 'axios'

// Resolve URL curta (meli.la, mluvem.com) para URL completa
async function resolve(url) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return res.request?.res?.responseUrl || res.config?.url || url
  } catch (err) {
    // axios lança erro em redirect — a URL final fica em err.request
    return err?.request?._redirectable?._currentUrl || url
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
