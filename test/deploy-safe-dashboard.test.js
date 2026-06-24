import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('deploy_safe_dashboard.sh keeps required hard gates', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy_safe_dashboard.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  assert.match(script, /npm\s+run\s+build/, 'build gate is required')
  assert.match(script, /\.next\/BUILD_ID/, 'BUILD_ID artifact check is required')
  assert.match(script, /\.next\/prerender-manifest\.json/, 'prerender manifest check is required')
  assert.match(script, /ensure_pm2_app_running "dashboard"/, 'dashboard restart/recreate is required')
  assert.match(script, /ensure_pm2_app_running "api"/, 'api restart/recreate is required')
  assert.match(script, /node\s+scripts\/verify-dashboard-api-proxy\.mjs/, 'dashboard API proxy build verification is required')
  assert.match(script, /for\s+path\s+in\s+\/login\s+\/admin\s+\/painel/, 'smoke-test routes must include /login /admin /painel')
  assert.match(script, /POST \/api\/auth\/login/, 'login API smoke test is required')
  assert.match(script, /assert_next_static_assets_available "dashboard \/admin"/, 'production must verify that /admin referenced Next static JS/CSS assets return 200')
  assert.match(script, /\/_next\\\/static\\\//, 'static asset verifier must inspect /_next/static references')
  assert.match(script, /x-nextjs-prerender/, 'login API smoke test must reject Next.js prerender 404 responses')
  assert.match(script, /curl\s+-s\s+-o\s+\/dev\/null\s+-w\s+"%\{http_code\}"/, 'smoke tests must assert http status code')
})
