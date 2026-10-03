import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// Item 12 da auditoria (5.1/5.2): o menu do admin tem só 5 entradas e as
// páginas /admin/observabilidade e /admin/emails foram encaixadas.

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const existe = (rel) => existsSync(new URL(`../${rel}`, import.meta.url))
const inicio = read('dashboard/app/admin/page.js')
const operacao = read('dashboard/app/admin/operacao/page.js')
const nav = inicio.slice(inicio.indexOf('<nav className="flex flex-wrap gap-1">'), inicio.indexOf('</nav>'))

test('o menu do Início tem exatamente as 5 entradas', () => {
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(hrefs, ['/admin/hoje', '/admin/clientes', '/admin/receita', '/admin/funil', '/admin/operacao'])
})

test('Capacidade, Erros e Contato não ficam mais no cabeçalho do Início', () => {
  const cabecalho = inicio.slice(inicio.indexOf('sticky top-0 z-20'), inicio.indexOf('{error && <Alert type="error" title="Painel admin"'))
  for (const href of ['/admin/capacidade', '/admin/erros', '/admin/emails', '/admin/teste-shard', '/admin/observabilidade']) {
    assert.ok(!cabecalho.includes(`href="${href}"`), `${href} voltou ao cabeçalho do Início`)
  }
})

test('Capacidade e Erros vivem dentro da Operação', () => {
  assert.match(operacao, /href="\/admin\/capacidade"/)
  assert.match(operacao, /href="\/admin\/erros"/)
  assert.match(operacao, /href="\/admin\/operacao\/modelos"/)
  assert.match(operacao, /<SaudeSection \/>/)
})

test('/admin/observabilidade e /admin/emails foram apagadas e nada aponta para elas', () => {
  assert.ok(!existe('dashboard/app/admin/observabilidade/page.js'))
  assert.ok(!existe('dashboard/app/admin/emails/page.js'))
  for (const rel of ['dashboard/app/admin/page.js', 'dashboard/app/admin/operacao/page.js', 'dashboard/app/admin/receita/page.js', 'dashboard/app/admin/hoje/page.js', 'dashboard/app/admin/clientes/page.js', 'dashboard/components/AdminContato.js', 'dashboard/components/SaudeSection.js']) {
    assert.ok(!/["'`]\/admin\/(observabilidade|emails)["'`]/.test(read(rel)), `${rel} ainda aponta para página apagada`)
  }
})

test('Saúde mantém GO/NO-GO e a fila de pagamentos com confirmação', () => {
  const saude = read('dashboard/components/SaudeSection.js')
  assert.match(saude, /goNoGo/)
  assert.match(saude, /async function runReprocess\(\)/)
  assert.match(saude, /if \(!window\.confirm\(/)
  assert.ok(saude.indexOf('window.confirm(') < saude.indexOf('api.adminPaymentDlqReprocess('))
})

test('contato: um só componente, duas rotas finas (massa e modelos)', () => {
  const contato = read('dashboard/components/AdminContato.js')
  const massa = read('dashboard/app/admin/clientes/contato/page.js')
  const modelos = read('dashboard/app/admin/operacao/modelos/page.js')
  assert.match(massa, /<AdminContato modo="massa" \/>/)
  assert.match(modelos, /<AdminContato modo="modelos" \/>/)
  assert.ok(massa.split('\n').length < 15 && modelos.split('\n').length < 15, 'as rotas são finas, sem componente duplicado')
  assert.match(contato, /confirmTotal: previa\.total/)
  assert.match(contato, /modelos: \[\['modelos'/)
  assert.ok(/massa: \[[^\]]*'enviar'[\s\S]*'whatsapp'/.test(contato))
})

test('o AGENTS.md continua enxuto e sem apontar para as páginas apagadas', () => {
  const agents = read('AGENTS.md')
  assert.ok(agents.length < 40 * 1024)
  assert.ok(!/\/admin\/(observabilidade|emails)\b/.test(agents))
})
