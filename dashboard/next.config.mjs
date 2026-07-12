import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' ws: wss:",
  "frame-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ')

// Strict-Transport-Security só pode ser emitido na borda HTTPS. Produção
// (espelhagrupos.com.br) é HTTPS via Nginx/Let's Encrypt; staging é servido
// por HTTP (http://178.105.54.0:3006) e o smoke de deploy rejeita HSTS lá.
// Por isso os headers sensíveis ao protocolo dependem de APP_ENV: NODE_ENV é
// 'production' nos DOIS ambientes, então não serve como discriminador.
const HSTS_VALUE = 'max-age=31536000; includeSubDomains'

function buildSecurityHeaders() {
  const isProduction = process.env.APP_ENV === 'production'

  const headers = [
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'SAMEORIGIN',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), bluetooth=()',
    },
    {
      // Em produção a CSP é enforced; em staging/dev permanece em observação
      // (report-only) para não bloquear recursos antes de validar a política.
      key: isProduction ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      value: contentSecurityPolicy,
    },
  ]

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: HSTS_VALUE,
    })
  }

  return headers
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const noIndexHeaders = [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow',
      },
    ]

    // O HTML das telas autenticadas (admin/dashboard) é uma casca SPA que
    // referencia chunks JS com hash no nome. Se o browser reaproveitar o HTML
    // antigo do cache após um deploy, ele aponta para um chunk que já não
    // existe (ou para código pré-fix), e a tela quebra — foi o que derrubou o
    // /admin com "adminStagingStatus is not a function" mesmo após o fix já
    // estar no ar. `no-store` força o browser a buscar o HTML fresco sempre,
    // pegando os hashes novos. Os assets /_next/static seguem imutáveis e
    // cacheáveis (não casam com estas rotas).
    const noStoreHtmlHeaders = [
      ...noIndexHeaders,
      {
        key: 'Cache-Control',
        value: 'no-store, must-revalidate',
      },
    ]

    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
      {
        source: '/admin/:path*',
        headers: noStoreHtmlHeaders,
      },
      {
        source: '/api/:path*',
        headers: noIndexHeaders,
      },
      {
        source: '/login',
        headers: noIndexHeaders,
      },
      {
        source: '/cadastro',
        headers: noIndexHeaders,
      },
      {
        source: '/promo-vip-7dias',
        headers: noIndexHeaders,
      },
    ]
  },
}

export default nextConfig
