import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const root = new URL('..', import.meta.url).pathname
const run = (script, args, env = {}) => spawnSync('bash', [join(root, 'scripts', script), ...args], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' })
const out = r => `${r.stdout}${r.stderr}`

function authFixture() {
  const base = mkdtempSync(join(tmpdir(), 'wabot-no-'))
  const auth = join(base, 'auth_info')
  for (const u of ['userA', 'userB']) {
    mkdirSync(join(auth, u), { recursive: true })
    writeFileSync(join(auth, u, 'creds.json'), `{"u":"${u}"}`)
  }
  return { base, auth, backups: join(base, 'backups') }
}

test('MN-13 backup_no: gera arquivo por servidor com manifesto e marcador de sucesso', () => {
  const f = authFixture()
  const r = run('backup_no.sh', [], { NODE_ID: 'n2', AUTH_INFO_DIR: f.auth, BACKUP_DIR: f.backups, NODE_DIR: f.base })
  assert.equal(r.status, 0, out(r))
  const files = readdirSync(f.backups)
  assert.ok(files.some(n => /^wabot-node-n2-\d{8}-\d{6}\.tar\.gz$/.test(n)), files.join())
  assert.ok(existsSync(join(f.backups, 'last_success_node_n2.txt')))
  assert.match(out(r), /2 conta\(s\), 2 arquivo\(s\)/)
  assert.match(out(r), /SEM cifra/)
})

test('MN-13 backup_no: exige NODE_ID válido, auth_info com conteúdo e respeita REQUIRE_ENCRYPTION', () => {
  const f = authFixture()
  assert.notEqual(run('backup_no.sh', [], { AUTH_INFO_DIR: f.auth, BACKUP_DIR: f.backups }).status, 0)
  assert.match(out(run('backup_no.sh', [], { NODE_ID: 'N:2', AUTH_INFO_DIR: f.auth, BACKUP_DIR: f.backups })), /NODE_ID inválido/)
  const vazio = mkdtempSync(join(tmpdir(), 'wabot-vazio-')); mkdirSync(join(vazio, 'auth_info'))
  assert.match(out(run('backup_no.sh', [], { NODE_ID: 'n2', AUTH_INFO_DIR: join(vazio, 'auth_info'), BACKUP_DIR: f.backups })), /auth_info vazio/)
  const r = run('backup_no.sh', [], { NODE_ID: 'n2', AUTH_INFO_DIR: f.auth, BACKUP_DIR: f.backups, BACKUP_REQUIRE_ENCRYPTION: '1' })
  assert.notEqual(r.status, 0)
  assert.equal(existsSync(f.backups) ? readdirSync(f.backups).filter(n => n.endsWith('.tar.gz')).length : 0, 0, 'não pode sobrar texto puro')
})

test('MN-13 restaurar: simulação não grava; APLICAR restaura SÓ a conta pedida', () => {
  const f = authFixture()
  run('backup_no.sh', [], { NODE_ID: 'n2', AUTH_INFO_DIR: f.auth, BACKUP_DIR: f.backups, NODE_DIR: f.base })
  const arquivo = join(f.backups, readdirSync(f.backups).find(n => n.endsWith('.tar.gz')))
  const destino = join(mkdtempSync(join(tmpdir(), 'wabot-dest-')), 'auth_info')

  const sim = run('restaurar_auth_conta.sh', [arquivo, 'userA'], { AUTH_INFO_DIR: destino })
  assert.equal(sim.status, 0, out(sim))
  assert.match(out(sim), /simulação/)
  assert.equal(existsSync(destino), false)

  const ok = run('restaurar_auth_conta.sh', [arquivo, 'userA'], { AUTH_INFO_DIR: destino, APLICAR: '1' })
  assert.equal(ok.status, 0, out(ok))
  assert.equal(readFileSync(join(destino, 'userA', 'creds.json'), 'utf8'), '{"u":"userA"}')
  assert.equal(existsSync(join(destino, 'userB')), false, 'não pode espalhar o login de outra conta')
})

test('MN-13 restaurar: recusa sobrescrever; FORCAR guarda o antigo ao lado; conta ausente falha', () => {
  const f = authFixture()
  run('backup_no.sh', [], { NODE_ID: 'n2', AUTH_INFO_DIR: f.auth, BACKUP_DIR: f.backups, NODE_DIR: f.base })
  const arquivo = join(f.backups, readdirSync(f.backups).find(n => n.endsWith('.tar.gz')))
  const destino = join(mkdtempSync(join(tmpdir(), 'wabot-dest-')), 'auth_info')
  mkdirSync(join(destino, 'userA'), { recursive: true }); writeFileSync(join(destino, 'userA', 'creds.json'), 'ANTIGO')

  const nega = run('restaurar_auth_conta.sh', [arquivo, 'userA'], { AUTH_INFO_DIR: destino, APLICAR: '1' })
  assert.notEqual(nega.status, 0)
  assert.equal(readFileSync(join(destino, 'userA', 'creds.json'), 'utf8'), 'ANTIGO')

  const forca = run('restaurar_auth_conta.sh', [arquivo, 'userA'], { AUTH_INFO_DIR: destino, APLICAR: '1', FORCAR: '1' })
  assert.equal(forca.status, 0, out(forca))
  assert.equal(readFileSync(join(destino, 'userA', 'creds.json'), 'utf8'), '{"u":"userA"}')
  assert.ok(readdirSync(destino).some(n => n.startsWith('userA.antes-')), 'o login antigo não pode ser apagado')

  assert.notEqual(run('restaurar_auth_conta.sh', [arquivo, 'naoExiste'], { AUTH_INFO_DIR: destino, APLICAR: '1' }).status, 0)
})

test('MN-12 deploy_node: simulação por padrão, não roda migration nem reinicia o supervisor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wabot-repo-'))
  spawnSync('git', ['init', '-q'], { cwd: dir })
  const r = run('deploy_node.sh', [], { NODE_DIR: dir })
  assert.equal(r.status, 0, out(r))
  assert.match(out(r), /\(simulação\)/)
  const src = readFileSync(join(root, 'scripts/deploy_node.sh'), 'utf8')
  assert.doesNotMatch(src, /migrate (deploy|dev)/)
  assert.match(src, /REINICIAR_SUPERVISOR:-0/)
})

test('MN-12 deploy_node: recusa pasta que não é um clone git', () => {
  const nogit = mkdtempSync(join(tmpdir(), 'wabot-nogit-'))
  assert.match(out(run('deploy_node.sh', [], { NODE_DIR: nogit })), /não é um clone git/)
})

test('MN-12 ecosystem de nó: só o supervisor (api/dashboard/cron duplicariam tarefas)', () => {
  const eco = createRequire(import.meta.url)('../ecosystem.node.config.cjs')
  assert.deepEqual(eco.apps.map(a => a.name), ['bot-supervisor'])
})
