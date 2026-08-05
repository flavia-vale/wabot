import test from 'node:test'
import assert from 'node:assert/strict'

import nextConfig from '../dashboard/next.config.mjs'

async function globalHeadersFor(appEnv) {
  const previous = process.env.APP_ENV
  if (appEnv === undefined) {
    delete process.env.APP_ENV
  } else {
    process.env.APP_ENV = appEnv
  }
  try {
    const rules = await nextConfig.headers()
    const globalRule = rules.find(({ source }) => source === '/:path*')
    assert.ok(globalRule, 'a global header rule must cover every dashboard path')
    return headersByKey(globalRule)
  } finally {
    if (previous === undefined) {
      delete process.env.APP_ENV
    } else {
      process.env.APP_ENV = previous
    }
  }
}

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
  // Era `frame-src 'none'`. O tutorial oficial embutido na home caía nessa
  // regra e o visitante via "Este conteudo esta bloqueado" no lugar do vídeo
  // (confirmado em produção, 2026-08-05). Liberado UM host, o player sem
  // cookie do YouTube — a intenção da trava (nada de terceiro arbitrário
  // dentro de um iframe nosso) continua valendo, e o teste
  // `frame-src continua restrito` abaixo é quem garante isso.
  'frame-src https://www.youtube-nocookie.com',
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
]

function headersByKey(rule) {
  return new Map(rule.headers.map(({ key, value }) => [key, value]))
}

/* `frame-src` deixou de ser `'none'` para permitir o tutorial oficial, então a
 * proteção passa a ser por ALLOWLIST em vez de proibição total. Sem esta
 * checagem, alguém "consertando" um embed futuro poderia trocar por `https:`
 * ou `*` e reabrir o site para conteúdo de terceiro arbitrário — que é
 * exatamente o que o `'none'` original existia para impedir. */
const ALLOWED_FRAME_SOURCES = new Set(['https://www.youtube-nocookie.com'])

function assertFrameSrcStaysRestricted(csp) {
  const directive = csp.split('; ').find((part) => part.startsWith('frame-src'))
  assert.ok(directive, 'CSP must declare frame-src')

  const sources = directive.split(/\s+/).slice(1)
  assert.ok(sources.length > 0, 'frame-src must not be empty')

  for (const source of sources) {
    if (source === "'none'") continue
    assert.ok(
      ALLOWED_FRAME_SOURCES.has(source),
      `frame-src must stay restricted to the allowlist; "${source}" is not allowed. ` +
        'Curinga ("*"), esquema solto ("https:") ou host novo exigem decisão consciente aqui.',
    )
  }
}

function assertCspDirectives(csp) {
  assert.doesNotMatch(csp, /'unsafe-eval'/, 'CSP must not allow unsafe-eval')
  for (const directive of requiredCspDirectives) {
    assert.ok(csp.split('; ').includes(directive), `CSP must include: ${directive}`)
  }
  assertFrameSrcStaysRestricted(csp)
}

test('dashboard keeps CSP report-only and no HSTS outside production (staging is HTTP)', async () => {
  for (const appEnv of ['staging', undefined]) {
    const headers = await globalHeadersFor(appEnv)
    for (const [key, value] of Object.entries(expectedSecurityHeaders)) {
      assert.equal(headers.get(key), value, `${key} must use the approved value`)
    }

    const csp = headers.get('Content-Security-Policy-Report-Only')
    assert.ok(csp, `CSP must be report-only for APP_ENV=${appEnv}`)
    assert.equal(headers.has('Content-Security-Policy'), false, 'CSP must not be enforced outside production')
    assert.equal(headers.has('Strict-Transport-Security'), false, 'HSTS must not be sent over HTTP staging')
    assertCspDirectives(csp)
  }
})

test('dashboard enforces CSP and emits HSTS in production', async () => {
  const headers = await globalHeadersFor('production')
  for (const [key, value] of Object.entries(expectedSecurityHeaders)) {
    assert.equal(headers.get(key), value, `${key} must use the approved value`)
  }

  const csp = headers.get('Content-Security-Policy')
  assert.ok(csp, 'CSP must be enforced in production')
  assert.equal(headers.has('Content-Security-Policy-Report-Only'), false, 'production must not also send report-only CSP')
  assertCspDirectives(csp)

  assert.equal(
    headers.get('Strict-Transport-Security'),
    'max-age=31536000; includeSubDomains',
    'production must emit the approved HSTS value at the HTTPS edge',
  )
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
