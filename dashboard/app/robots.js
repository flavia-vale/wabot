export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/termos', '/privacidade', '/quem-somos', '/suporte'],
        disallow: ['/dashboard', '/dashboard/', '/dashboard/*', '/api/*', '/promo-vip-7dias'],
      },
    ],
    sitemap: 'http://espelhagrupos.com.br/sitemap.xml',
    host: 'http://espelhagrupos.com.br',
  }
}
