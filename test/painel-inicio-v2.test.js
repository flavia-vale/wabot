/* Guarda da tela inicial do painel (desenho "Painel v2", 2026-09-19).
 *
 * O que estes testes travam é a ORDEM e o CONTEÚDO combinados com a dona do
 * produto: checklist primeiro, depois os quatro números, depois as funções
 * mais usadas. Sem isso, a próxima pessoa a mexer na tela reintroduz gráfico
 * no topo e a primeira coisa que a cliente vê deixa de ser "o que falta fazer".
 *
 * Travam também o elo com o back end: cada número precisa sair de uma chamada
 * real. Card com número escrito à mão é o jeito mais rápido de a tela mentir.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const page = read('../dashboard/app/painel/page.js')
const rota = read('../src/api/routes/dashboard.js')
const css = read('../dashboard/app/painel/painel.css')

test('a checklist vem ANTES dos cards e das funções', () => {
  // A ordem que importa é a do JSX renderizado — comentário e constante no
  // topo do arquivo não dizem nada sobre o que a cliente vê primeiro.
  const jsx = page.slice(page.indexOf('return ('))
  const checklist = jsx.indexOf('<ActivationChecklist')
  const cards = jsx.indexOf('className="pv-stats"')
  const funcoes = jsx.indexOf('Funções mais usadas')
  assert.ok(checklist > -1, 'a checklist de ativação sumiu da tela inicial')
  assert.ok(cards > -1, 'os cards de números sumiram da tela inicial')
  assert.ok(funcoes > -1, 'o bloco de funções mais usadas sumiu da tela inicial')
  assert.ok(checklist < cards, 'a checklist precisa vir antes dos cards')
  assert.ok(cards < funcoes, 'os cards precisam vir antes das funções mais usadas')
})

test('os quatro cards são exatamente os combinados', () => {
  for (const rotulo of ['Lojas conectadas', 'Grupos monitorados', 'Grupos de destino', 'Ofertas enviadas hoje']) {
    assert.ok(page.includes(rotulo), `card "${rotulo}" faltando`)
  }
  const chaves = [...page.matchAll(/^\s{4}key: '(\w+)',$/gm)].map((m) => m[1])
  assert.deepEqual(chaves, ['stores', 'monitorGroups', 'postGroups', 'offersToday'])
})

test('todo número da tela vem do back end, nenhum é escrito à mão', () => {
  assert.ok(page.includes('api.dashboardStatus()'), 'os contadores precisam vir de GET /api/dashboard/status')
  assert.ok(page.includes("api.logsSummary('today')"), 'as ofertas de hoje precisam vir de GET /api/logs/summary?period=today')
  // `values` é o único lugar que alimenta os cards; nenhum literal numérico
  // pode entrar ali.
  const bloco = page.slice(page.indexOf('const values = {'), page.indexOf('return ('))
  assert.ok(!/:\s*\d/.test(bloco), 'card com número fixo na tela — precisa vir da API')
})

test('as quatro funções mais usadas, com "Ofertas automáticas" em roxo', () => {
  const bloco = page.slice(page.indexOf('const ACTIONS = ['), page.indexOf('export default'))
  const rotulos = [...bloco.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(rotulos, ['Criar oferta', 'Espelhamento', 'Ofertas automáticas', 'Grupos e Canais'])
  // Só "Ofertas automáticas" é PRO.
  const pro = [...bloco.matchAll(/label: '([^']+)'[^\n]*pro: true/g)].map((m) => m[1])
  assert.deepEqual(pro, ['Ofertas automáticas'])
  // O roxo do PRO precisa existir de fato no CSS — classe sem regra é tile
  // verde com etiqueta roxa, que não é o que foi combinado.
  assert.ok(/\.pv-action\.is-pro\s*\{/.test(css), 'falta a regra .pv-action.is-pro')
  assert.ok(/--pv-pro:\s*#6F4FE8/i.test(css), 'falta o token roxo do PRO')
})

test('toda função traz o nome do plano por extenso, e só a PRO é roxa', () => {
  // "PRO" sozinho era lido como enfeite. O nome do plano por extenso é o que
  // deixa a cliente saber o que já tem e o que é upgrade sem abrir a tela.
  const bloco = page.slice(page.indexOf('const ACTIONS = ['), page.indexOf('export default'))
  const tags = [...bloco.matchAll(/tag: '([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(tags, ['Plano Basic', 'Plano Basic', 'Plano PRO', 'Plano Basic'])
  assert.ok(page.includes('pv-action-tag'), 'a etiqueta de plano sumiu da tela')
  // A etiqueta é verde por padrão e só fica roxa dentro do tile PRO — senão
  // as quatro ficam roxas e o upgrade deixa de se distinguir.
  assert.ok(
    /\.pv-action\.is-pro \.pv-action-tag\s*\{[^}]*--pv-pro/.test(css),
    'a etiqueta do tile PRO precisa de regra própria com o roxo',
  )
})

test('no celular os cards ficam DOIS por linha, nunca um só', () => {
  // Quatro cards de largura inteira empurram as funções mais usadas para fora
  // da primeira tela — e é por elas que a cliente abre o painel.
  // painel.css tem varios blocos de 480px; o que importa e o que governa
  // .pv-stats. Localiza pela propria regra, nunca pelo primeiro @media.
  const i = css.indexOf('.pv-stats', css.lastIndexOf('@media (max-width: 480px)', css.indexOf('.pv-stat-ico { display: none')))
  assert.ok(i > -1, 'a regra de celular de .pv-stats sumiu')
  const regra = css.slice(i, css.indexOf('}', i) + 1)
  assert.ok(
    /\.pv-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2/.test(regra),
    'no celular .pv-stats precisa ficar em 2 colunas',
  )
  assert.ok(
    !/\.pv-stats\s*\{[^}]*grid-template-columns:\s*1fr\s*;/.test(regra),
    'voltou a uma coluna no celular',
  )
})

test('cada card abre a tela que muda aquele número', () => {
  for (const href of ['/painel/ids-afiliada', '/painel/grupos', '/painel/envios']) {
    assert.ok(page.includes(`href: '${href}'`), `card sem caminho para ${href}`)
  }
})

test('a rota devolve os contadores sem quebrar os booleanos da checklist', () => {
  // A checklist de ativação lê estes quatro campos — se algum sumir, o
  // onboarding para de se marcar sozinho.
  for (const campo of ['waConnected', 'hasCredentials', 'hasMonitorGroup', 'hasPostGroup', 'hasSuccessfulLog']) {
    assert.ok(rota.includes(`${campo}:`), `a rota perdeu o campo ${campo}, usado pela checklist`)
  }
  for (const campo of ['stores', 'monitorGroups', 'postGroups']) {
    assert.ok(new RegExp(`${campo}:`).test(rota), `a rota não devolve counts.${campo}`)
  }
})

test('"loja conectada" é credencial COMPLETA, nunca linha na tabela', () => {
  // Contar linha faria o painel dizer "1 loja conectada" para quem salvou a
  // loja com campo faltando — e a oferta dela sai como skip:no_valid_conversions.
  assert.ok(rota.includes('validateCredentialData'), 'a contagem de lojas precisa validar a credencial')
  assert.ok(/configured\s*===\s*true/.test(rota), 'a contagem de lojas precisa exigir configured === true')
})

test('linguagem leiga: nada de jargão nos rótulos da tela inicial', () => {
  for (const jargao of ['jid', 'JID', 'dedup', 'payload', 'webhook', 'worker', 'supervisor', 'skip:']) {
    assert.ok(!page.includes(jargao), `jargão "${jargao}" chegou à tela inicial`)
  }
})
