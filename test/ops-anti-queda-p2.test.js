// P2 do plano anti-queda do pm2 (RCA 2026-10-01): staging com pm2 próprio,
// autocura opt-in e aviso quando o deploy reinicia os robôs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8')

// pm2 falso com um estado POR PM2_HOME (dois daemons de verdade).
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-'))
  const main = path.join(dir, 'pm2-main')
  const stg = path.join(dir, 'pm2-staging')
  fs.mkdirSync(main)
  const st = (name, status = 'online') => ({ name, pm2_env: { status } })
  fs.writeFileSync(path.join(main, 'state.json'), JSON.stringify([st('api'), st('dashboard'), st('bot-supervisor'), st('api-staging'), st('visual-staging')]))
  fs.writeFileSync(path.join(main, 'dump.pm2'), JSON.stringify(['api', 'dashboard', 'bot-supervisor', 'api-staging', 'visual-staging'].map(name => ({ name }))))
  const fake = path.join(dir, 'pm2')
  fs.writeFileSync(fake, `#!/usr/bin/env node
const fs = require('fs'); const path = require('path')
const home = process.env.PM2_HOME; fs.mkdirSync(home, { recursive: true })
const f = path.join(home, 'state.json')
let apps = []; try { apps = JSON.parse(fs.readFileSync(f, 'utf8')) } catch {}
const [cmd, ...rest] = process.argv.slice(2)
if (cmd === 'jlist') process.stdout.write(JSON.stringify(apps))
else if (cmd === 'delete') { apps = apps.filter(a => !rest.includes(a.name)); fs.writeFileSync(f, JSON.stringify(apps)) }
else if (cmd === 'start') { for (const n of rest[rest.indexOf('--only') + 1].split(',')) apps.push({ name: n, pm2_env: { status: 'online' } }); fs.writeFileSync(f, JSON.stringify(apps)) }
else if (cmd === 'save') fs.writeFileSync(path.join(home, 'dump.pm2'), JSON.stringify(apps.map(a => ({ name: a.name }))))
`)
  fs.chmodSync(fake, 0o755)
  const env = {
    ...process.env, PM2_BIN: fake, PATH: `${dir}:${process.env.PATH}`, MAIN_PM2_HOME: main, STAGING_PM2_HOME: stg,
    WABOT_STAGING_PM2_HOME_FILE: path.join(dir, 'marker'), WABOT_JANELA_FILE: path.join(dir, 'janela'), STAGING_DIR: ROOT,
  }
  const names = home => { try { return JSON.parse(fs.readFileSync(path.join(home, 'state.json'), 'utf8')).map(a => a.name) } catch { return [] } }
  return { dir, main, stg, env, names }
}
const run = (env) => spawnSync('bash', [path.join(ROOT, 'scripts/migrar-pm2-staging.sh')], { env, encoding: 'utf8' })

test('migrar-pm2-staging: dry-run não mexe em nada', () => {
  const sb = sandbox()
  const r = run(sb.env)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /DRY-RUN/)
  assert.match(r.stdout, /api-staging visual-staging/)
  assert.equal(sb.names(sb.main).length, 5)
})

test('migrar-pm2-staging: sem janela aberta não aplica', () => {
  const sb = sandbox()
  const r = run({ ...sb.env, APLICAR: '1' })
  assert.equal(r.status, 4)
  assert.equal(sb.names(sb.main).length, 5)
})

test('migrar-pm2-staging: aplica (produção intacta), grava o marcador e desfaz', () => {
  const sb = sandbox()
  fs.writeFileSync(sb.env.WABOT_JANELA_FILE, 'x | fulana | migrar\n')
  const r = run({ ...sb.env, APLICAR: '1' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.deepEqual(sb.names(sb.main).sort(), ['api', 'bot-supervisor', 'dashboard'])
  assert.deepEqual(sb.names(sb.stg).sort(), ['api-staging', 'visual-staging'])
  assert.equal(fs.readFileSync(sb.env.WABOT_STAGING_PM2_HOME_FILE, 'utf8').trim(), sb.stg)
  const mainDump = JSON.parse(fs.readFileSync(path.join(sb.main, 'dump.pm2'), 'utf8')).map(a => a.name).sort()
  assert.deepEqual(mainDump, ['api', 'bot-supervisor', 'dashboard'], 'dump da produção salvo sem o staging, pelo guarda')
  const back = run({ ...sb.env, APLICAR: '1', REVERTER: '1' })
  assert.equal(back.status, 0, back.stdout + back.stderr)
  assert.equal(sb.names(sb.main).length, 5)
  assert.equal(fs.existsSync(sb.env.WABOT_STAGING_PM2_HOME_FILE), false)
})

test('deploy de staging usa o pm2 do staging quando o marcador existe', () => {
  const s = read('scripts/deploy_safe_staging.sh')
  assert.match(s, /source "\$SCRIPT_DIR\/lib\/staging-pm2-home\.sh"\nwabot_staging_pm2_home/)
  const sb = sandbox()
  fs.writeFileSync(sb.env.WABOT_STAGING_PM2_HOME_FILE, '/x/.pm2-staging\n')
  const r = spawnSync('bash', ['-c', `source ${JSON.stringify(path.join(ROOT, 'scripts/lib/staging-pm2-home.sh'))}; wabot_staging_pm2_home >/dev/null; echo "$PM2_HOME"`], { env: { ...sb.env, PM2_HOME: '' }, encoding: 'utf8' })
  assert.equal(r.stdout.trim(), '/x/.pm2-staging')
})

test('autocura (P2-2) nasce desligada, respeita janela e intervalo', () => {
  const s = read('scripts/vigia_cron.sh')
  assert.match(s, /"\$\{VIGIA_AUTOCURA:-0\}" = "1"/)
  assert.match(s, /\[ ! -f "\$JANELA_FILE" \]/)
  assert.match(s, /VIGIA_AUTOCURA_INTERVALO_S:-1800/)
  assert.match(s, /APLICAR=1 .*scripts\/religar-producao\.sh/)
})

test('aviso de reinício pelo deploy (P2-3) é opt-in e nunca falha o deploy', () => {
  const s = read('scripts/deploy_safe_dashboard.sh')
  assert.match(s, /grep -q '\^DEPLOY_AVISO_REINICIO=1' "\$ROOT_DIR\/\.env"/)
  assert.match(s, /scripts\/avisar-admin\.mjs" "Deploy reiniciou os robôs[^\n]*\|\| true/)
})
