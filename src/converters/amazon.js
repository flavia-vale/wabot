import axios from 'axios'

const ASIN_RE = /\/dp\/([A-Z0-9]{10})/i

// Resolve short URL (amzn.to / a.co) to full URL
async function resolve(url) {
  try {
    const { request } = await axios.get(url, {
      maxRedirects: 5,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return request.res?.responseUrl || url
  } catch {
    return url
  }
}

export async function convert(url, creds) {
  const { tag, marketplace = 'amazon.com.br' } = creds
  try {
    let target = url
    if (/amzn\.to|a\.co/.test(url)) target = await resolve(url)

    const asinMatch = target.match(ASIN_RE)
    if (asinMatch) {
      return `https://www.${marketplace}/dp/${asinMatch[1]}?tag=${tag}`
    }

    // No ASIN found — inject tag into existing URL
    const u = new URL(target)
    u.searchParams.set('tag', tag)
    return u.toString()
  } catch {
    return null
  }
}
