import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

test('legacy /dashboard and /m application trees stay removed', () => {
  for (const relativePath of [
    'dashboard/app/dashboard',
    'dashboard/app/m',
    'dashboard/middleware.js',
    'dashboard/lib/ui-variant/routeMap.js',
    'dashboard/lib/ui-variant/device.js',
  ]) {
    assert.equal(exists(relativePath), false, `${relativePath} must not be restored`)
  }
})

test('dashboard config does not redirect or configure retired application routes', async () => {
  const { default: nextConfig } = await import('../dashboard/next.config.mjs')
  const redirects = typeof nextConfig.redirects === 'function' ? await nextConfig.redirects() : []
  const headers = await nextConfig.headers()

  assert.equal(redirects.some(({ source }) => source === '/dashboard' || source.startsWith('/dashboard/')), false)
  assert.equal(headers.some(({ source }) => source === '/dashboard/:path*' || source === '/m/:path*'), false)
})
