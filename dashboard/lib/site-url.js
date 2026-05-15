const DEFAULT_SITE_URL = 'https://espelhagrupos.com.br'

export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL
  return raw.replace(/\/$/, '')
}

