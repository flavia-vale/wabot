import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('login diagnostics script collects assertive staging signals without leaking tokens', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'collect-login-404-diagnostics.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  assert.match(script, /BASE_URL="\$\{1:-http:\/\/127\.0\.0\.1:3006\}"/, 'defaults to visual staging port')
  assert.match(script, /API_URL="\$\{API_URL:-http:\/\/127\.0\.0\.1:3004\}"/, 'defaults to API staging port')
  assert.match(script, /pm2 logs visual-staging --lines 80 --nostream/, 'collects visual-staging logs')
  assert.match(script, /pm2 logs api-staging --lines 80 --nostream/, 'collects api-staging logs')
  assert.match(script, /app-paths-manifest\.json/, 'checks dashboard build manifest')
  assert.match(script, /\/api\/auth\/login/, 'probes login endpoint')
  assert.match(script, /Authorization: Bearer /, 'redacts authorization headers')
  assert.match(script, /<JWT_REDACTED>/, 'redacts JWT-like tokens')
})
