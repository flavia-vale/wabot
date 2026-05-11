import { getSiteUrl } from '../lib/site-url'

const baseUrl = getSiteUrl()

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/termos', '/privacidade', '/quem-somos', '/suporte', '/api/public/faq', '/api/public/plans'],
        disallow: ['/dashboard', '/dashboard/', '/dashboard/*', '/api/*', '/promo-vip-7dias'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
