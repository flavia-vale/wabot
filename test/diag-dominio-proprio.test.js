import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(raiz, 'scripts', 'diag-dominio-proprio.mjs')

function rodar(linhas, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'diag-dp-'))
  const log = join(dir, 'bot.log')
  writeFileSync(log, linhas.map(l => JSON.stringify(l)).join('\n') + '\n')
  return execFileSync(process.execPath, [script, `--log=${log}`, '--sem-contas', ...extra], { encoding: 'utf8' })
}

const agora = Date.now()
const ok = (jid, from, platform) => ({
  level: 30, time: agora, jid,
  resolvidos: [{ from, to: 'https://loja/x', platform }],
  msg: 'Link de domínio próprio desembrulhado até a loja',
})
const falha = (jid, url, reason) => ({
  level: 40, time: agora, jid,
  falhas: [{ url, reason }],
  msg: 'Link de domínio próprio NÃO resolveu até a loja',
})

test('agrupa por site e separa resolveu de não resolveu', () => {
  const saida = rodar([
    ok('a@g.us', 'https://siteum.com.br/p/1', 'amazon'),
    ok('a@g.us', 'https://siteum.com.br/p/2', 'amazon'),
    falha('b@g.us', 'https://sitedois.com.br/p/3', 'pagina_sem_link_de_loja'),
  ])
  assert.match(saida, /links vistos: 3 \| resolveram: 2 \| não resolveram: 1/)
  assert.match(saida, /taxa de sucesso: 66\.7%/)
  assert.match(saida, /siteum\.com\.br\s+→ 2 ok \/ 0 falha/)
  assert.match(saida, /sitedois\.com\.br\s+→ 0 ok \/ 1 falha/)
})

test('o motivo da falha aparece agregado — é ele que decide a ação', () => {
  // Cada motivo pede um conserto diferente: site que barra o servidor (403),
  // página que só monta o link por JavaScript, e lentidão. Somá-los num número
  // só esconderia justamente a informação que decide o que fazer.
  const saida = rodar([
    falha('a@g.us', 'https://barrado.com/1', 'recusado_http_403'),
    falha('a@g.us', 'https://barrado.com/2', 'recusado_http_403'),
    falha('b@g.us', 'https://semhtml.com/1', 'pagina_sem_link_de_loja'),
    falha('c@g.us', 'https://lento.com/1', 'tempo_esgotado'),
  ])
  assert.match(saida, /recusado_http_403\s+2 link\(s\) em 1 site\(s\): barrado\.com/)
  assert.match(saida, /pagina_sem_link_de_loja\s+1 link\(s\) em 1 site\(s\): semhtml\.com/)
  assert.match(saida, /tempo_esgotado\s+1 link\(s\)/)
})

test('respeita a janela de tempo', () => {
  const saida = rodar([
    ok('a@g.us', 'https://recente.com.br/p/1', 'amazon'),
    { ...ok('a@g.us', 'https://antigo.com.br/p/1', 'amazon'), time: 1 },
  ])
  assert.match(saida, /recente\.com\.br/)
  assert.doesNotMatch(saida, /antigo\.com\.br/, 'link fora da janela não pode entrar na conta')
})

test('log sem nenhum link de domínio próprio diz isso, em vez de tabela vazia', () => {
  const saida = rodar([{ level: 30, time: agora, msg: 'outra coisa qualquer' }])
  assert.match(saida, /Nenhum link de domínio próprio/)
  assert.match(saida, /histórico começa do zero/)
})

test('é read-only: não escreve no banco nem envia nada', () => {
  const fonte = readFileSync(script, 'utf8')
  for (const proibido of ['.create(', '.update(', '.delete(', '.upsert(', 'sendTemplateEmail', 'sendMail']) {
    assert.ok(!fonte.includes(proibido), `diagnóstico não pode conter ${proibido}`)
  }
})
