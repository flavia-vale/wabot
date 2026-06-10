import { getSiteUrl } from '../lib/site-url'

const baseUrl = getSiteUrl()

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/llms.txt', '/pricing.md', '/termos', '/privacidade', '/quem-somos', '/suporte', '/api/public/faq', '/api/public/plans'],
        disallow: ['/painel', '/painel/*', '/dashboard', '/dashboard/*', '/api/admin/*', '/api/auth/*', '/api/dashboard/*', '/api/payments/*', '/promo-vip-7dias'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
