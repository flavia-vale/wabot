import { getSiteUrl } from '../lib/site-url'

const baseUrl = getSiteUrl()

export default function sitemap() {
  return ['/', '/termos', '/privacidade', '/quem-somos', '/suporte'].map((route) => ({
    url: `${baseUrl}${route === '/' ? '' : route}`,
    lastModified: new Date('2026-05-05'),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.6,
  }))
}
