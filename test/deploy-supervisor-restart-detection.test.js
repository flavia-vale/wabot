import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptProd = fs.readFileSync(path.join(raiz, 'scripts', 'deploy_safe_dashboard.sh'), 'utf8')
const workflow = fs.readFileSync(path.join(raiz, '.github', 'workflows', 'deploy.yml'), 'utf8')

// RCA 2026-08-31 — a cliente configurou "card com marca d'água" e a oferta saía
// sem marca. O código estava certo e em `main`; o que não estava era rodando: o
// bot-supervisor de produção nunca reiniciava, então os bot-workers seguiam com
// o bot-worker.js antigo em memória.
//
// A decisão de reiniciar comparava o commit ANTES e DEPOIS do sync. Só que o
// passo "Deploy via SSH" do workflow já faz `git reset --hard origin/main`
// ANTES de chamar o script — quando o script media HEAD, o clone já estava no
// commit novo, os dois lados davam o mesmo valor e o diff saía vazio. Todo
// deploy de produção imprimia "Nenhuma mudança em código dos bots".
//
// Estes testes rodam a função de verdade, extraída do próprio script, num
// repositório git temporário que reproduz a ordem do workflow.
function extrairFuncao(script, nome) {
  const inicio = script.indexOf(`${nome}() {`)
  assert.notEqual(inicio, -1, `função ${nome} não encontrada no script`)
  const fim = script.indexOf('\n}\n', inicio)
  assert.notEqual(fim, -1, `fim da função ${nome} não encontrado`)
  return script.slice(inicio, fim + 3)
}

const WORKER_CODE_PATHS_RE = scriptProd.match(/^WORKER_CODE_PATHS_RE=('.*')$/m)?.[1]
assert.ok(WORKER_CODE_PATHS_RE, 'WORKER_CODE_PATHS_RE não encontrado no script')

function repoDeTeste() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wabot-deploy-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'teste@exemplo.com')
  git('config', 'user.name', 'Teste')
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'src', 'api'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'src', 'bot-worker.js'), '// versão antiga\n')
  fs.writeFileSync(path.join(dir, 'src', 'api', 'server.js'), '// api\n')
  git('add', '-A'); git('commit', '-q', '-m', 'antes')
  const antes = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim()
  fs.writeFileSync(path.join(dir, 'src', 'bot-worker.js'), '// marca d\'água no card\n')
  git('add', '-A'); git('commit', '-q', '-m', 'card com marca')
  const depois = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim()
  return { dir, antes, depois }
}

function decidir({ dir, revisionBeforeDeploy }) {
  // Reproduz o script: REVISION_BEFORE_SYNC sai de REVISION_BEFORE_DEPLOY
  // quando ele existe, senão de `git rev-parse HEAD` — que, na ordem do
  // workflow de produção, já é o commit NOVO.
  const corpo = [
    'set -uo pipefail',
    `WORKER_CODE_PATHS_RE=${WORKER_CODE_PATHS_RE}`,
    'REVISION_BEFORE_SYNC="${REVISION_BEFORE_DEPLOY:-$(git rev-parse HEAD 2>/dev/null || true)}"',
    'REVISION_AFTER_SYNC="$(git rev-parse HEAD 2>/dev/null || true)"',
    extrairFuncao(scriptProd, 'worker_code_changed_in_sync'),
    'if worker_code_changed_in_sync; then echo REINICIA; else echo PRESERVA; fi',
  ].join('\n')
  return execFileSync('bash', ['-c', corpo], {
    cwd: dir,
    env: { ...process.env, ...(revisionBeforeDeploy ? { REVISION_BEFORE_DEPLOY: revisionBeforeDeploy } : {}) },
  }).toString().trim()
}

test('sem o commit anterior, a detecção NUNCA dispara — era o bug de produção', () => {
  const { dir } = repoDeTeste()
  // O workflow já resetou para o commit novo antes de chamar o script.
  assert.equal(decidir({ dir }), 'PRESERVA')
})

test('com REVISION_BEFORE_DEPLOY, mudança em bot-worker.js reinicia o supervisor', () => {
  const { dir, antes } = repoDeTeste()
  assert.equal(decidir({ dir, revisionBeforeDeploy: antes }), 'REINICIA')
})

test('deploy que só mexe na API continua preservando as sessões', () => {
  const { dir } = repoDeTeste()
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  const antes = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim()
  fs.writeFileSync(path.join(dir, 'src', 'api', 'server.js'), '// só rota\n')
  git('add', '-A'); git('commit', '-q', '-m', 'api')
  assert.equal(decidir({ dir, revisionBeforeDeploy: antes }), 'PRESERVA')
})

test('a rede de segurança olha só os caminhos que o worker carrega', () => {
  const { dir } = repoDeTeste()
  const corpo = [
    'set -uo pipefail',
    `WORKER_CODE_PATHS_RE=${WORKER_CODE_PATHS_RE}`,
    extrairFuncao(scriptProd, 'newest_worker_code_epoch'),
    'newest_worker_code_epoch',
  ].join('\n')
  const antigo = () => Number(execFileSync('bash', ['-c', corpo], { cwd: dir }).toString().trim())

  const base = antigo()
  assert.ok(Number.isFinite(base) && base > 0, 'precisa medir o mtime do código dos bots')

  // Mexer só na API não pode envelhecer/renovar a medição — senão todo deploy
  // de rota reconectaria todas as sessões.
  const futuro = new Date(Date.now() + 60 * 60 * 1000)
  fs.utimesSync(path.join(dir, 'src', 'api', 'server.js'), futuro, futuro)
  assert.equal(antigo(), base, 'arquivo fora do caminho dos workers não pode contar')

  fs.utimesSync(path.join(dir, 'src', 'bot-worker.js'), futuro, futuro)
  assert.ok(antigo() > base, 'código de worker mais novo precisa ser detectado')
})

test('o workflow captura o commit ANTES do reset e passa ao script', () => {
  const trecho = workflow.slice(workflow.indexOf('Enviando para PRODUÇÃO'))
  const captura = trecho.indexOf('REVISION_BEFORE_DEPLOY="$(git rev-parse HEAD')
  const reset = trecho.indexOf('git reset --hard origin/main')
  assert.notEqual(captura, -1, 'o workflow precisa capturar o commit anterior')
  assert.notEqual(reset, -1)
  assert.ok(captura < reset, 'capturar DEPOIS do reset mede o commit novo nos dois lados — é o bug')
  assert.match(trecho, /REVISION_BEFORE_DEPLOY="\$REVISION_BEFORE_DEPLOY"/, 'o valor precisa chegar ao script')
})

test('preservar as sessões com código velho não é silencioso', () => {
  assert.match(scriptProd, /workers_running_stale_code/)
  assert.match(scriptProd, /As correções deste deploy NÃO valem para os clientes/)
})
