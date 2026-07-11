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
  assert.match(script, /export APP_ENV="\$\{APP_ENV:-staging\}"/, 'staging build must set APP_ENV so next.config bakes report-only CSP, not enforced')
  assert.match(script, /npm run build/, 'dashboard build is required before next start')
  assert.match(script, /node scripts\/verify-dashboard-api-proxy\.mjs/, 'proxy route artifact must be verified')
  assert.match(script, /ensure_pm2_app_running "\$API_APP"/, 'api-staging restart is required')
  assert.match(script, /recreate_frontend_pm2_app "\$VISUAL_APP" "\$VISUAL_PORT"/, 'visual-staging must be recreated to kill stale Next child processes')
  assert.match(script, /pm2 delete "\$app_name"/, 'frontend recreate must delete the old PM2 wrapper')
  assert.match(script, /fuser -k "\$\{port\}\/tcp"/, 'frontend recreate must clear orphan listeners on the visual port')
  assert.match(script, /pm2 restart "\$app_name" --update-env/, 'ensure_pm2_app_running must restart with --update-env')
  assert.match(script, /x-nextjs-prerender/, 'smoke test must reject Next.js prerender responses')
  assert.match(script, /content-type: .*application\/json/, 'smoke test must require JSON API response')
  assert.match(script, /assert_dashboard_security_headers/, 'dashboard security headers must be checked in staging')
  assert.match(script, /assert_next_static_assets_available "visual \/admin"/, 'staging must verify that /admin referenced Next static JS/CSS assets return 200')
  assert.match(script, /\/_next\\\/static\\\//, 'static asset verifier must inspect /_next/static references')
  assert.ok(script.includes('X-Content-Type-Options:[[:space:]]*nosniff'), 'staging must require nosniff')
  assert.ok(script.includes('X-Frame-Options:[[:space:]]*SAMEORIGIN'), 'staging must require same-origin framing')
  assert.ok(script.includes('Referrer-Policy:[[:space:]]*strict-origin-when-cross-origin'), 'staging must require the approved referrer policy')
  assert.match(script, /'Permissions-Policy' 'Content-Security-Policy-Report-Only'/, 'staging must require Permissions Policy and report-only CSP')
  assert.match(script, /grep -Eqi '\^Strict-Transport-Security:'/, 'staging HTTP must reject Strict-Transport-Security')
})

test('deploy_safe_staging.sh only preserves the supervisor during migration in remote mode', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy_safe_staging.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  // Default must be mode-aware (empty), not a hardcoded "1" that keeps the
  // standby supervisor holding the SQLite lock and breaking DDL migrations
  // (pegadinha #8 / CI "database is locked" no autodeploy de staging).
  assert.match(
    script,
    /PRESERVE_SUPERVISOR_DURING_MIGRATION="\$\{PRESERVE_SUPERVISOR_DURING_MIGRATION:-\}"/,
    'preserve default must be empty (mode-aware), not 1',
  )
  assert.match(script, /read_env_var_from_file BOT_SUPERVISOR_MODE/, 'must read the effective supervisor mode from .env')
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
