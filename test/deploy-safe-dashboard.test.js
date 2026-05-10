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
  assert.match(script, /pm2\s+restart\s+dashboard\s+--update-env/, 'dashboard restart is required')
  assert.match(script, /pm2\s+restart\s+api\s+--update-env/, 'api restart is required')
  assert.match(script, /for\s+path\s+in\s+\/login\s+\/admin\s+\/dashboard/, 'smoke-test routes must include /login /admin /dashboard')
  assert.match(script, /curl\s+-s\s+-o\s+\/dev\/null\s+-w\s+"%\{http_code\}"/, 'smoke tests must assert http status code')
})
