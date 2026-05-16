import { getSiteUrl } from './site-url'

export function buildOgImageUrl({ slug = 'home', cluster = 'generic', template = 'landing' } = {}) {
  const base = getSiteUrl()
  const params = new URLSearchParams({ slug, cluster, template })
  return `${base}/api/public/og?${params.toString()}`
}
