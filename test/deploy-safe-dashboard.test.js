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
  assert.match(script, /recreate_frontend_pm2_app "dashboard" "\$DASHBOARD_PORT"/, 'dashboard must be recreated to kill stale Next child processes')
  assert.match(script, /pm2 delete "\$app_name"/, 'frontend recreate must delete the old PM2 wrapper')
  assert.match(script, /fuser -k "\$\{port\}\/tcp"/, 'frontend recreate must clear orphan listeners on the dashboard port')
  assert.match(script, /ensure_pm2_app_running "api"/, 'api restart/recreate is required')
  assert.match(script, /node\s+scripts\/verify-dashboard-api-proxy\.mjs/, 'dashboard API proxy build verification is required')
  assert.match(script, /for\s+path\s+in\s+\/login\s+\/admin\s+\/painel/, 'smoke-test routes must include /login /admin /painel')
  assert.match(script, /POST \/api\/auth\/login/, 'login API smoke test is required')
  assert.match(script, /assert_next_static_assets_available "dashboard \/admin"/, 'production must verify that /admin referenced Next static JS/CSS assets return 200')
  assert.match(script, /\/_next\\\/static\\\//, 'static asset verifier must inspect /_next/static references')
  assert.match(script, /x-nextjs-prerender/, 'login API smoke test must reject Next.js prerender 404 responses')
  assert.match(script, /curl\s+-s[A-Za-z]*\s+.*-w\s+"%\{http_code\}"/, 'smoke tests must assert http status code')
})

test('deploy_safe_dashboard.sh only preserves the supervisor during migration in remote mode', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy_safe_dashboard.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  // Prod is canonically inline too; a hardcoded preserve=1 leaves the standby
  // bot-supervisor holding the prod.db WAL connection and the DDL migration
  // fails with "database is locked" (pegadinha #8).
  assert.match(
    script,
    /PRESERVE_SUPERVISOR_DURING_MIGRATION="\$\{PRESERVE_SUPERVISOR_DURING_MIGRATION:-\}"/,
    'preserve default must be empty (mode-aware), not 1',
  )
  assert.match(script, /read_env_var_from_file_prod BOT_SUPERVISOR_MODE/, 'must read the effective supervisor mode from .env')
  assert.match(
    script,
    /elif \[\[ "\$BOT_SUPERVISOR_MODE_EFFECTIVE" == "remote" \]\]; then\s*\n\s*PRESERVE_SUPERVISOR_EFFECTIVE="1"/,
    'supervisor is only preserved when mode is remote',
  )
  assert.match(
    script,
    /if \[\[ "\$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" \]\]; then/,
    'migration branch must key off the resolved (mode-aware) decision',
  )
})
