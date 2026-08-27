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

test('deploy_safe_dashboard.sh auto-escalates supervisor stop when a preserved migration lock never clears', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy_safe_dashboard.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  // RCA 2026-07: preserving bot-supervisor in remote mode during a pending
  // DDL migration is not a transient lock — bot-workers write continuously,
  // so the exclusive lock window never opens and the 5 retries always fail.
  // The escalation kill switch must default to ON so automatic push deploys
  // self-heal instead of getting stuck until someone notices and manually
  // re-runs the workflow with stop_supervisor_for_migration.
  assert.match(
    script,
    /AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION="\$\{AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION:-1\}"/,
    'escalation must default to enabled (1), overridable without a redeploy',
  )
  assert.match(script, /attempt_migrate_deploy_prod\(\)/, 'migrate retry loop must be a reusable function so it can be called again after escalating')
  assert.match(
    script,
    /if attempt_migrate_deploy_prod 5 "preservando bot-supervisor"; then/,
    'first pass must still try preserving the supervisor before escalating',
  )
  assert.match(
    script,
    /MIGRATE_OK" != "1" && "\$PRESERVE_SUPERVISOR_EFFECTIVE" == "1" && "\$AUTO_ESCALATE_SUPERVISOR_FOR_MIGRATION" != "0"/,
    'escalation must only trigger when the first pass failed, supervisor was preserved, and the kill switch is not off',
  )
  assert.match(
    script,
    /stop_app_for_migration_prod "bot-supervisor" 1\s*\n\s*if attempt_migrate_deploy_prod 3 "pós-escalonamento"; then/,
    'escalation must stop bot-supervisor (restart_after=1, so it gets revived) and retry the migrate deploy',
  )
})

// RCA 2026-08 ("código novo não carregado pelos bots") + pedido da usuária
// 2026-08-26: em modo remote, o deploy reinicia a API mas não os bot-workers,
// então toda correção em código que o WORKER executa chegava ao disco e ficava
// dormente até alguém reiniciar o supervisor à mão. Três fixes seguidos foram
// entregues "verdes" e sem efeito por causa disso. O deploy passa a decidir
// sozinho — e só quando o código dos bots realmente mudou, porque reiniciar o
// supervisor reconecta TODAS as sessões WhatsApp.
test('deploy_safe_dashboard.sh reinicia o supervisor quando o deploy traz código dos bots', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy_safe_dashboard.sh')
  const script = fs.readFileSync(scriptPath, 'utf8')

  assert.match(script, /REVISION_BEFORE_SYNC="\$\(git rev-parse HEAD/, 'precisa guardar o commit ANTES do pull para comparar')
  assert.match(script, /RESTART_SUPERVISOR="\$\{RESTART_SUPERVISOR:-auto\}"/, 'o default precisa ser a decisão automática')
  assert.match(script, /worker_code_changed_in_sync/, 'a decisão precisa vir do diff do próprio deploy')
  assert.match(script, /git diff --name-only "\$REVISION_BEFORE_SYNC" "\$REVISION_AFTER_SYNC"/, 'compara os arquivos que entraram neste deploy')

  for (const caminho of ['src/bot-worker', 'src/supervisor/', 'src/core/', 'src/converters/']) {
    assert.ok(script.includes(caminho), `WORKER_CODE_PATHS_RE precisa cobrir ${caminho}`)
  }
  assert.match(script, /RESTART_SUPERVISOR=0\n    echo "  Nenhuma mudança em código dos bots/, 'deploy que não toca no worker preserva as sessões')
})
