// Testes de EXECUÇÃO (não só de texto) dos scripts do plano anti-queda do pm2
// (RCA 2026-10-01). Usam um pm2 falso: um script node que guarda o estado
// num JSON, para reproduzir "o pm2 perdeu o bot-supervisor".
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hasFlock = spawnSync('bash', ['-c', 'command -v flock']).status === 0

function sandbox(apps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anti-queda-'))
  const state = path.join(dir, 'state.json')
  const pm2home = path.join(dir, 'pm2home')
  fs.mkdirSync(pm2home)
  fs.writeFileSync(state, JSON.stringify(apps.map(([name, status = 'online']) => ({ name, pm2_env: { status } }))))
  const fake = path.join(dir, 'pm2')
  fs.writeFileSync(fake, `#!/usr/bin/env node
const fs = require('fs'); const path = require('path')
const st = ${JSON.stringify(state)}; const home = ${JSON.stringify(pm2home)}
const apps = JSON.parse(fs.readFileSync(st, 'utf8'))
const [cmd, ...rest] = process.argv.slice(2)
fs.appendFileSync(path.join(home, 'calls.log'), [cmd, ...rest].join(' ') + '\\n')
if (cmd === 'jlist') process.stdout.write(JSON.stringify(apps))
else if (cmd === 'start') { const n = rest[rest.indexOf('--only') + 1]; apps.push({ name: n, pm2_env: { status: 'online' } }); fs.writeFileSync(st, JSON.stringify(apps)) }
else if (cmd === 'save') fs.writeFileSync(path.join(home, 'dump.pm2'), JSON.stringify(apps.map(a => ({ name: a.name }))))
`)
  fs.chmodSync(fake, 0o755)
  const env = { ...process.env, PM2_BIN: fake, PM2_HOME: pm2home, PATH: `${dir}:${process.env.PATH}`, WABOT_DEPLOY_LOCK: path.join(dir, 'deploy.lock'), WABOT_JANELA_FILE: path.join(dir, 'janela'), BOT_SUPERVISOR_MODE: 'remote', VIGIA_EXPECTED_APPS: '', DOTENV_CONFIG_PATH: path.join(dir, 'nao-existe.env') }
  return { dir, pm2home, env, calls: () => { try { return fs.readFileSync(path.join(pm2home, 'calls.log'), 'utf8') } catch { return '' } } }
}

test('pm2-save-seguro: cenário de 01/10 é RECUSADO e o dump não muda', () => {
  const sb = sandbox([['api-staging'], ['visual-staging']])
  const dump = JSON.stringify(['api', 'dashboard', 'bot-supervisor', 'api-staging', 'visual-staging'].map(name => ({ name })))
  fs.writeFileSync(path.join(sb.pm2home, 'dump.pm2'), dump)
  const r = spawnSync('node', [path.join(ROOT, 'scripts/pm2-save-seguro.mjs')], { env: sb.env, encoding: 'utf8' })
  assert.equal(r.status, 3, r.stderr)
  assert.match(r.stderr, /RECUSADO/)
  assert.equal(fs.readFileSync(path.join(sb.pm2home, 'dump.pm2'), 'utf8'), dump)
  assert.doesNotMatch(sb.calls(), /^save/m)
})

test('pm2-save-seguro: tudo de pé salva e guarda cópia do dump anterior', () => {
  const sb = sandbox([['api'], ['dashboard'], ['bot-supervisor']])
  fs.writeFileSync(path.join(sb.pm2home, 'dump.pm2'), JSON.stringify([{ name: 'api' }, { name: 'dashboard' }, { name: 'bot-supervisor' }]))
  const r = spawnSync('node', [path.join(ROOT, 'scripts/pm2-save-seguro.mjs')], { env: sb.env, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(sb.calls(), /^save/m)
  assert.ok(fs.readdirSync(sb.pm2home).some(f => f.startsWith('dump.pm2.bak-')))
})

test('religar-producao: dry-run só mostra; APLICAR=1 sobe SÓ o que falta e salva', () => {
  const sb = sandbox([['api'], ['dashboard']])
  fs.writeFileSync(path.join(sb.pm2home, 'dump.pm2'), JSON.stringify([{ name: 'api' }, { name: 'dashboard' }, { name: 'bot-supervisor' }]))
  const env = { ...sb.env, ROOT_DIR: ROOT, RELIGAR_ESPERA_S: '0', RELIGAR_SEM_VIGIA: '1' }
  const seco = spawnSync('bash', [path.join(ROOT, 'scripts/religar-producao.sh')], { env, encoding: 'utf8' })
  assert.equal(seco.status, 0, seco.stdout + seco.stderr)
  assert.match(seco.stdout, /Faltando no pm2: bot-supervisor/)
  assert.match(seco.stdout, /DRY-RUN/)
  assert.doesNotMatch(sb.calls(), /^start/m)
  const r = spawnSync('bash', [path.join(ROOT, 'scripts/religar-producao.sh')], { env: { ...env, APLICAR: '1' }, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const starts = sb.calls().split('\n').filter(l => l.startsWith('start'))
  assert.deepEqual(starts.map(l => l.split('--only ')[1].split(' ')[0]), ['bot-supervisor'])
  assert.match(sb.calls(), /^save/m)
})

test('religar-producao: nada faltando = nada a fazer; janela aberta = para', () => {
  const sb = sandbox([['api'], ['dashboard'], ['bot-supervisor']])
  const env = { ...sb.env, ROOT_DIR: ROOT }
  const r = spawnSync('bash', [path.join(ROOT, 'scripts/religar-producao.sh')], { env, encoding: 'utf8' })
  assert.match(r.stdout, /Nada faltando/)
  fs.writeFileSync(sb.env.WABOT_JANELA_FILE, 'x | fulana | apt\n')
  const j = spawnSync('bash', [path.join(ROOT, 'scripts/religar-producao.sh')], { env, encoding: 'utf8' })
  assert.equal(j.status, 4)
  assert.match(j.stdout, /Janela de manutenção aberta/)
})

test('janela.sh abre, recusa abrir duas vezes e fecha', () => {
  const sb = sandbox([['api'], ['dashboard'], ['bot-supervisor']])
  const env = { ...sb.env, ROOT_DIR: path.join(sb.dir, 'sem-retrato') }
  const run = (...a) => spawnSync('bash', [path.join(ROOT, 'scripts/janela.sh'), ...a], { env, encoding: 'utf8' })
  assert.equal(run('abrir').status, 2, 'motivo é obrigatório')
  assert.equal(run('abrir', 'instalar age').status, 0)
  assert.match(fs.readFileSync(sb.env.WABOT_JANELA_FILE, 'utf8'), /instalar age/)
  assert.equal(run('abrir', 'outra').status, 3)
  assert.match(run('status').stdout, /ABERTA/)
  run('fechar')
  assert.equal(fs.existsSync(sb.env.WABOT_JANELA_FILE), false)
})

test('trava de deploy: janela aberta impede o deploy (código 76)', () => {
  const sb = sandbox([])
  fs.writeFileSync(sb.env.WABOT_JANELA_FILE, 'x | fulana | apt\n')
  const script = path.join(sb.dir, 'deploy.sh')
  fs.writeFileSync(script, `set -euo pipefail\nsource ${JSON.stringify(path.join(ROOT, 'scripts/lib/deploy-lock.sh'))}\nwabot_deploy_lock bash "$0" "$@"\necho RODOU\n`)
  const r = spawnSync('bash', [script], { env: sb.env, encoding: 'utf8' })
  assert.equal(r.status, 76)
  assert.doesNotMatch(r.stdout, /RODOU/)
})

test('trava de deploy: dois deploys em paralelo rodam um depois do outro', { skip: !hasFlock && 'flock ausente' }, async () => {
  const sb = sandbox([])
  const out = path.join(sb.dir, 'ordem.log')
  const script = path.join(sb.dir, 'deploy.sh')
  fs.writeFileSync(script, `set -euo pipefail\nsource ${JSON.stringify(path.join(ROOT, 'scripts/lib/deploy-lock.sh'))}\nwabot_deploy_lock bash "$0" "$@"\necho "inicio $1" >> ${JSON.stringify(out)}\nsleep 0.6\necho "fim $1" >> ${JSON.stringify(out)}\n`)
  const runOne = tag => new Promise(resolve => spawn('bash', [script, tag], { env: sb.env }).on('exit', resolve))
  const codes = await Promise.all([runOne('A'), new Promise(r => setTimeout(r, 100)).then(() => runOne('B'))])
  assert.deepEqual(codes, [0, 0])
  const linhas = fs.readFileSync(out, 'utf8').trim().split('\n')
  assert.deepEqual(linhas.map(l => l.split(' ')[0]), ['inicio', 'fim', 'inicio', 'fim'], linhas.join(' | '))
})

test('trava de deploy: processo filho em segundo plano NÃO herda a trava', { skip: !hasFlock && 'flock ausente' }, () => {
  // Sem `flock -o`, um daemon do pm2 nascido no deploy seguraria a trava para sempre.
  const sb = sandbox([])
  const script = path.join(sb.dir, 'deploy.sh')
  fs.writeFileSync(script, `set -euo pipefail\nsource ${JSON.stringify(path.join(ROOT, 'scripts/lib/deploy-lock.sh'))}\nwabot_deploy_lock bash "$0" "$@"\n( sleep 5 >/dev/null 2>&1 & )\necho ok\n`)
  assert.equal(spawnSync('bash', [script], { env: sb.env }).status, 0)
  const t0 = Date.now()
  const second = spawnSync('bash', [script], { env: { ...sb.env, WABOT_DEPLOY_LOCK_WAIT_S: '3' }, encoding: 'utf8' })
  assert.equal(second.status, 0, second.stdout)
  assert.ok(Date.now() - t0 < 2500, 'o segundo deploy não pode esperar o sleep do primeiro')
})

test('deploys usam a trava e o save protegido (nunca pm2 save cru)', () => {
  for (const f of ['deploy_safe_staging.sh', 'deploy_safe_dashboard.sh']) {
    const s = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')
    assert.match(s, /wabot_deploy_lock bash "\$0" "\$@"/, f)
    assert.match(s, /scripts\/pm2-save-seguro\.mjs/, f)
    assert.doesNotMatch(s.replace(/^\s*#.*$/gm, '').replace(/echo ".*pm2 save.*"/g, ''), /^\s*pm2 save\s*$/m, f)
  }
})

test('ecosystem: log com nome fixo por app (sem id)', async () => {
  const { default: cfg } = await import(path.join(ROOT, 'ecosystem.config.cjs'))
  for (const a of cfg.apps) {
    assert.ok(a.out_file.endsWith(`/${a.name}-out.log`), a.name)
    assert.ok(a.error_file.endsWith(`/${a.name}-error.log`), a.name)
  }
})

test('/ready/bots registrado nos dois caminhos, fora do rate limit e sem números na resposta', () => {
  const s = fs.readFileSync(path.join(ROOT, 'src/api/server.js'), 'utf8')
  assert.match(s, /app\.get\('\/ready\/bots', botsReadinessHandler\)/)
  assert.match(s, /app\.get\('\/api\/ready\/bots', botsReadinessHandler\)/)
  assert.match(s, /RATE_LIMIT_ALLOWLIST = new Set\(\[[^\]]*'\/api\/ready\/bots'/)
  assert.match(s, /const \{ ok, reason \} = botsReadinessCache\.value/)
})

test('template de aviso do vigia é interno (admin)', async () => {
  const { getTemplateDefinition } = await import(path.join(ROOT, 'src/email/registry.js'))
  const d = getTemplateDefinition('admin_servidor_vigia')
  assert.equal(d.audience, 'admin')
  assert.deepEqual(d.variables.map(v => v.name), ['resumo', 'detalhe', 'quando'])
})
