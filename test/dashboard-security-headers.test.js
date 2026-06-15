import test from 'node:test'
import assert from 'node:assert/strict'

import nextConfig from '../dashboard/next.config.mjs'

const expectedSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), bluetooth=()',
}

const requiredCspDirectives = [
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
]

function headersByKey(rule) {
  return new Map(rule.headers.map(({ key, value }) => [key, value]))
}

test('dashboard applies global security headers with CSP in report-only mode', async () => {
  const rules = await nextConfig.headers()
  const globalRule = rules.find(({ source }) => source === '/:path*')

  assert.ok(globalRule, 'a global header rule must cover every dashboard path')

  const headers = headersByKey(globalRule)
  for (const [key, value] of Object.entries(expectedSecurityHeaders)) {
    assert.equal(headers.get(key), value, `${key} must use the approved value`)
  }

  const csp = headers.get('Content-Security-Policy-Report-Only')
  assert.ok(csp, 'CSP must initially be report-only')
  assert.equal(headers.has('Content-Security-Policy'), false, 'CSP must not be enforced in PR1')
  assert.equal(headers.has('Strict-Transport-Security'), false, 'HSTS belongs at the HTTPS edge, not the dashboard')
  assert.doesNotMatch(csp, /'unsafe-eval'/, 'production CSP must not allow unsafe-eval')

  for (const directive of requiredCspDirectives) {
    assert.ok(csp.split('; ').includes(directive), `CSP must include: ${directive}`)
  }
})

test('dashboard preserves noindex headers for private and authentication routes', async () => {
  const rules = await nextConfig.headers()
  const expectedNoIndexSources = [
    '/admin/:path*',
    '/api/:path*',
    '/login',
    '/cadastro',
    '/promo-vip-7dias',
  ]

  for (const source of expectedNoIndexSources) {
    const rule = rules.find((candidate) => candidate.source === source)
    assert.ok(rule, `noindex rule must remain configured for ${source}`)
    assert.equal(headersByKey(rule).get('X-Robots-Tag'), 'noindex, nofollow')
  }
})
