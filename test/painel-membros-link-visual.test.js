import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const members = read('dashboard/app/painel/membros/MembersDashboard.js')
const links = read('dashboard/app/painel/link-inteligente/SmartLinksDashboard.js')
const painel = read('dashboard/app/painel/page.js')
const css = read('dashboard/app/painel/painel.css')

test('as telas novas não usam tabela: .pnl-table-wrap some em telas <=720px (celular)', () => {
  for (const src of [members, links]) {
    assert.doesNotMatch(src, /pnl-table-wrap/)
    assert.doesNotMatch(src, /<table/)
  }
})

test('Membros: filtro 24h/7d/30d, lembra a escolha e ordena sem histórico por último', () => {
  assert.match(members, /label: '24 h'/)
  assert.match(members, /label: '7 dias'/)
  assert.match(members, /label: '30 dias'/)
  assert.match(members, /localStorage/)
  assert.match(members, /Quem ainda não tem histórico vai para o fim/)
})

test('Link Inteligente: não diz mais que clique ocupa vaga; mostra cliques hoje/7 dias e membros/capacidade', () => {
  assert.doesNotMatch(links, /cada clique conta como uma vaga/)
  assert.match(links, /cliques hoje/)
  assert.match(links, /nos últimos 7 dias/)
  assert.match(links, /Clique não é entrada/)
  assert.match(links, /role="progressbar"/)
  assert.match(links, /vira reserva/)
  assert.match(links, /text: 'Reserva'/)
})

test('Link Inteligente: interruptores de aviso por e-mail e WhatsApp e último aviso', () => {
  assert.match(links, /notifyEmail: e\.target\.checked/)
  assert.match(links, /notifyWhatsapp: e\.target\.checked/)
  assert.match(links, /Avisar por e-mail/)
  assert.match(links, /próprio número/)
  assert.match(links, /Último aviso/)
})

test('Link Inteligente: plano vencido mostra por que os links pararam e leva para renovar', () => {
  assert.match(links, /planActive/)
  assert.match(links, /Seu plano venceu: seus links estão parados/)
  assert.match(links, /href="\/painel\/plano"/)
})

test('card do painel: Basic nunca chama a API (embaçado com exemplo); PRO busca o resumo', () => {
  const card = painel.slice(painel.indexOf('function OccupancyCard'), painel.indexOf('export default function PainelPage'))
  assert.match(card, /if \(!isPro \|\| !state\.loading\) return undefined/)
  assert.match(card, /pnl-kpi-locked/)
  assert.match(card, /ProTag/)
  assert.match(card, /90% de capacidade atingido/)
  assert.match(painel, /<OccupancyCard isPro=\{isPro\}/)
})

test('vermelho escuro do alerta é token local (sem hex solto nas telas)', () => {
  assert.match(css, /--danger-deep: #9b1c1c/)
  for (const src of [members, links, painel]) assert.doesNotMatch(src, /#9b1c1c|#b91c1c|#ff0000/i)
})
