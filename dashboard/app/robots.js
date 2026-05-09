const baseUrl = 'http://espelhagrupos.com.br'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/termos', '/privacidade', '/quem-somos', '/suporte'],
        disallow: ['/dashboard', '/dashboard/', '/dashboard/*', '/api/*', '/promo-vip-7dias'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
