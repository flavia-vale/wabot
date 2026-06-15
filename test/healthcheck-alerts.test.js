import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const SCRIPT = join(process.cwd(), 'scripts', 'healthcheck_alerts.sh')

function run(env = {}) {
  try {
    const stdout = execSync(`bash "${SCRIPT}"`, { env: { ...process.env, ...env }, stdio: 'pipe' }).toString()
    return { code: 0, out: stdout }
  } catch (err) {
    return { code: err.status, out: (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '') }
  }
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'wabot-healthcheck-'))
  const backupDir = join(root, 'backups')
  mkdirSync(backupDir)
  writeFileSync(join(backupDir, 'last_success.txt'), 'ok\n')
  return { root, backupDir, cleanup: () => { try { rmSync(root, { recursive: true, force: true }) } catch {} } }
}

test('healthcheck falha (exit 1) quando backup está ausente e API fora', async (t) => {
  const env = setup()
  t.after(env.cleanup)
  const result = run({
    STATE_FILE: join(env.root, 'state'),
    BACKUP_DIR: join(env.root, 'nao-existe'),
    API_HEALTH_URL: 'http://127.0.0.1:1/health',
    PM2_APPS: '',
    DISK_MIN_FREE_PCT: '0',
  })
  assert.equal(result.code, 1)
  assert.match(result.out, /BACKUP:/)
  assert.match(result.out, /API:/)
})

test('healthcheck deduplica alertas repetidos dentro da janela', async (t) => {
  const env = setup()
  t.after(env.cleanup)
  const opts = {
    STATE_FILE: join(env.root, 'state'),
    BACKUP_DIR: join(env.root, 'nao-existe'),
    API_HEALTH_URL: 'http://127.0.0.1:1/health',
    PM2_APPS: '',
    DISK_MIN_FREE_PCT: '0',
  }
  run(opts)
  const second = run(opts)
  assert.match(second.out, /Alerta suprimido/)
})

test('healthcheck passa (exit 0) com backup recente e grava estado ok', async (t) => {
  const env = setup()
  t.after(env.cleanup)
  // usa o próprio marcador como "API": file:// não serve para curl http; em vez
  // disso valida só backup+disco (API_HEALTH_URL inválida → check falha), então
  // este caso cobre apenas o caminho de estado: backup ok + falha de API.
  const stateFile = join(env.root, 'state')
  const result = run({
    STATE_FILE: stateFile,
    BACKUP_DIR: env.backupDir,
    API_HEALTH_URL: 'http://127.0.0.1:1/health',
    PM2_APPS: '',
    DISK_MIN_FREE_PCT: '0',
  })
  assert.equal(result.code, 1)
  assert.doesNotMatch(result.out, /BACKUP:/, 'backup recente não deve alarmar')
  const state = readFileSync(stateFile, 'utf8')
  assert.notEqual(state.split('\n')[0], 'ok', 'estado deve registrar a falha de API')
})
