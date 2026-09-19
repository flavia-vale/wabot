import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// A lista de caminhos que faz o deploy reiniciar o `bot-supervisor`
// (`WORKER_CODE_PATHS_RE`, nos dois scripts de deploy) é escrita à mão, e
// quem a escreve não tem como saber tudo o que o worker passou a importar.
//
// Medido em 2026-09-16: 33 arquivos carregados pelo bot-worker estavam de
// fora — entre eles `src/detector.js` (o fix dos links com formatação do
// WhatsApp), `src/messageDedup.js` e `src/messageLogSanitizer.js` (a correção
// do emoji cortado na chave de dedup). Uma correção em qualquer um deles ia
// para o disco do VPS e NÃO passava a valer nos bots, porque o deploy decidia
// "nenhuma mudança em código dos bots" e preservava o supervisor. Mesma
// família do RCA 2026-08-31 ("a marca d'água não saía porque os bots estavam
// com código velho"), só que pela lista e não pela medição do commit.
//
// Este teste calcula o que o worker e o supervisor DE FATO importam e exige
// que cada arquivo esteja ou coberto pela regex, ou na lista de exceções
// abaixo — com motivo. Assim ninguém precisa lembrar da lista: o teste lembra.

const ROOT = path.resolve(import.meta.dirname, '..')
const ENTRYPOINTS = ['src/bot-worker.js', 'src/supervisor/index.js']

// Alcançados SÓ pelo caminho de e-mail (o worker os carrega por causa do aviso
// interno de número repetido). Texto de e-mail velho dentro do worker não muda
// nada para a cliente, e incluí-los faria toda edição de texto reconectar a
// frota inteira — o preço é maior que o problema.
const DELIBERADAMENTE_FORA = new Set([
  'src/email/accountActivity.js',
  'src/email/adminAlerts.js',
  'src/email/dailyWindow.js',
  'src/email/dispatcher.js',
  'src/email/layout.js',
  'src/email/mailer.js',
  'src/email/markup.js',
  'src/email/optOut.js',
  'src/email/registry.js',
  'src/domain/painel/whatsappSafety.js',
  'src/tutorialVideo.js',
  'src/leadNurture/unsubscribeToken.js',
])

const IMPORT_RE = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g

function workerImportClosure() {
  const seen = new Set()
  const stack = [...ENTRYPOINTS]
  while (stack.length) {
    const rel = stack.pop()
    if (seen.has(rel)) continue
    seen.add(rel)
    let source
    try { source = readFileSync(path.join(ROOT, rel), 'utf8') } catch { continue }
    for (const match of source.matchAll(IMPORT_RE)) {
      const next = path.normalize(path.join(path.dirname(rel), match[1]))
      if (next.startsWith('src/')) stack.push(next)
    }
  }
  return [...seen].sort()
}

function workerCodePathsRegex(script) {
  const source = readFileSync(path.join(ROOT, 'scripts', script), 'utf8')
  const match = source.match(/^WORKER_CODE_PATHS_RE='(.+)'$/m)
  assert.ok(match, `${script}: WORKER_CODE_PATHS_RE não encontrado`)
  return new RegExp(match[1])
}

for (const script of ['deploy_safe_dashboard.sh', 'deploy_safe_staging.sh']) {
  test(`${script}: todo arquivo que o worker carrega ou reinicia o supervisor, ou está na lista de exceções`, () => {
    const regex = workerCodePathsRegex(script)
    const esquecidos = workerImportClosure()
      .filter(file => !regex.test(file) && !DELIBERADAMENTE_FORA.has(file))
    assert.deepEqual(
      esquecidos,
      [],
      'Estes arquivos são carregados pelo bot-worker/supervisor e NÃO reiniciam o supervisor no deploy — '
      + 'uma correção neles chega ao VPS e não passa a valer nos bots. Inclua na WORKER_CODE_PATHS_RE '
      + `dos DOIS scripts de deploy, ou em DELIBERADAMENTE_FORA com o motivo:\n  ${esquecidos.join('\n  ')}`,
    )
  })
}

test('os dois scripts de deploy usam exatamente a MESMA lista', () => {
  const dashboard = workerCodePathsRegex('deploy_safe_dashboard.sh').source
  const staging = workerCodePathsRegex('deploy_safe_staging.sh').source
  assert.equal(
    dashboard,
    staging,
    'produção e staging decidindo diferente sobre reiniciar o supervisor faz staging validar um comportamento que produção não tem',
  )
})

test('a lista cobre os arquivos do pipeline de mensagem que já ficaram de fora', () => {
  const regex = workerCodePathsRegex('deploy_safe_dashboard.sh')
  for (const file of [
    'src/detector.js',
    'src/messageDedup.js',
    'src/messageQueue.js',
    'src/messageLogSanitizer.js',
    'src/smartDelay.js',
    'src/sendQueueBackend.js',
    'src/domain/session/phoneReuse.js',
    'src/instagram/mirroring/capture.js',
  ]) {
    assert.ok(regex.test(file), `${file} precisa reiniciar o supervisor no deploy`)
  }
})

test('nenhuma exceção da lista deixou de ser importada (lista morta engana)', () => {
  const closure = new Set(workerImportClosure())
  const orfas = [...DELIBERADAMENTE_FORA].filter(file => !closure.has(file)).sort()
  assert.deepEqual(orfas, [], `exceções que o worker nem carrega mais — remova de DELIBERADAMENTE_FORA:\n  ${orfas.join('\n  ')}`)
})
