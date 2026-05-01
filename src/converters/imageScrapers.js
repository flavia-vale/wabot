const OG_IMAGE_RE = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
]

async function fetchOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WaBot/1.0; +https://wabot.com.br)' },
      signal: AbortSignal.timeout(5_000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    for (const re of OG_IMAGE_RE) {
      const m = html.match(re)
      if (m?.[1]) return m[1]
    }
    return null
  } catch {
    return null
  }
}

export async function fetchProductImage(platform, productUrl) {
  return fetchOgImage(productUrl)
}
