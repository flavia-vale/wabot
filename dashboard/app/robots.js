export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/termos', '/privacidade', '/quem-somos', '/suporte'],
        disallow: ['/dashboard', '/dashboard/', '/dashboard/*', '/api/*', '/promo-vip-7dias'],
      },
    ],
    sitemap: 'https://espelhagrupos.com.br/sitemap.xml',
    host: 'https://espelhagrupos.com.br',
  }
}
