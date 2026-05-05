export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/termos', '/privacidade', '/quem-somos', '/suporte'],
        disallow: ['/dashboard', '/dashboard/', '/dashboard/*', '/api/*'],
      },
    ],
    sitemap: 'http://178.105.54.0/sitemap.xml',
    host: 'http://178.105.54.0',
  }
}
