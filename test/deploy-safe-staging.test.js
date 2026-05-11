import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('deploy_safe_staging.sh rebuilds dashboard and blocks Next prerender login 404', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy_safe_staging.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  assert.match(script, /BRANCH="\$\{BRANCH:-develop\}"/, 'staging targets develop by default')
  assert.match(script, /SYNC_GIT="\$\{SYNC_GIT:-0\}"/, 'staging repair does not require git sync by default')
  assert.match(script, /npm ci/, 'dependencies must be installed without changing lockfiles')
  assert.match(script, /npx prisma migrate deploy/, 'staging migrations must run before restart')
  assert.match(script, /rm -rf \.next/, 'dashboard build must start from a clean .next')
  assert.match(script, /npm run build/, 'dashboard build is required before next start')
  assert.match(script, /node scripts\/verify-dashboard-api-proxy\.mjs/, 'proxy route artifact must be verified')
  assert.match(script, /pm2 restart "\$API_APP" --update-env/, 'api-staging restart is required')
  assert.match(script, /pm2 restart "\$VISUAL_APP" --update-env/, 'visual-staging restart is required')
  assert.match(script, /x-nextjs-prerender/, 'smoke test must reject Next.js prerender responses')
  assert.match(script, /content-type: .*application\/json/, 'smoke test must require JSON API response')
})
