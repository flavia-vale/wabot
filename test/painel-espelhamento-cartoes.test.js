/* Guarda do cartão de grupo do nível 1 (2026-09-19).
 *
 * Duas mudanças de desenho no mesmo dia, nesta ordem:
 *
 * 1. as duas colunas viraram um cartão por ORIGEM ("LÊ DE → PUBLICA EM"),
 *    porque cruzar as listas na cabeça para responder "esta origem publica
 *    onde?" era trabalhoso;
 * 2. as DUAS COLUNAS VOLTARAM, por decisão da dona do produto, quando a tela
 *    absorveu a de Grupos. O motivo é o que faltava no desenho de cartões: ele
 *    não tem porta de entrada para o DESTINO, e é no destino que moram imagem,
 *    marca d'água, boas-vindas, botão "Ver canal" e anti-ban. Sem a coluna de
 *    destinos, metade da tela de Grupos não teria onde ser absorvida.
 *
 * O que o cartão por origem entregava de bom **não** se perdeu e continua
 * verificado aqui: ele vive dentro do cartão da coluna de origem (quantas
 * ofertas saíram hoje, as lojas aceitas, "para onde envia"), montado pela MESMA
 * regra pura.
 *
 * As três formas de o cartão mentir, todas cobertas aqui:
 *
 * 1. escrever "0 ofertas hoje" para origem que o backend NÃO mediu
 *    (`GET /logs/summary` devolve só as 5 origens com mais movimento);
 * 2. mostrar origem sem loja nenhuma — `allowedPlatforms` vazio significa
 *    TODAS, é como a tela de grupos já lê o campo;
 * 3. gravar a escolha de destinos sem passar pela regra, apagando vínculo.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildMirrorCards,
  parseAllowedPlatforms,
  planMirrorCreation,
} from '../src/domain/painel/mirrorWizard.js'

const page = readFileSync(
  new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url),
  'utf8',
)
const css = readFileSync(
  new URL('../dashboard/app/painel/painel.css', import.meta.url),
  'utf8',
)

const ORIGENS = [
  { id: 'o1', name: 'Promoções Brasil', kind: 'group', waJid: '111@g.us', allowedPlatforms: 'shopee,amazon' },
  { id: 'o2', name: 'Cupons BR', kind: 'channel', waJid: '222@newsletter', allowedPlatforms: '' },
  { id: 'o3', name: 'Sem destino', kind: 'group', waJid: '333@g.us', allowedPlatforms: 'shopee' },
]
const DESTINOS = [
  { id: 'd1', name: 'Achados da Sol' },
  { id: 'd2', name: 'Tech & Casa' },
]
const TODAS = ['shopee', 'amazon', 'mercadolivre', 'magalu']

test('um cartão por ORIGEM, com os destinos que ela de fato tem', () => {
  const cards = buildMirrorCards({
    origens: ORIGENS,
    destinos: DESTINOS,
    links: {
      o1: { postIds: ['d1', 'd2'], mode: 'explicit' },
      o2: { postIds: ['d1', 'd2'], mode: 'all' },
      o3: { postIds: [], mode: 'explicit' },
    },
    topSources: [{ jid: '111@g.us', sent: 112 }],
    todasAsLojas: TODAS,
  })

  assert.equal(cards.length, 3)
  assert.deepEqual(cards[0].destinos.map((d) => d.name), ['Achados da Sol', 'Tech & Casa'])
  assert.equal(cards[0].modo, 'explicit')
  assert.equal(cards[2].semDestino, true, 'origem sem destino precisa aparecer como tal')
  assert.equal(cards[1].semDestino, false, "modo 'all' não é 'sem destino'")
})

test('destino apagado não vira pill fantasma no cartão', () => {
  // O endpoint pode devolver id de grupo que não existe mais enquanto a lista
  // não recarrega. Sem o filtro, a pill sairia vazia.
  const [card] = buildMirrorCards({
    origens: [ORIGENS[0]],
    destinos: DESTINOS,
    links: { o1: { postIds: ['d1', 'apagado'], mode: 'explicit' } },
    todasAsLojas: TODAS,
  })
  assert.deepEqual(card.destinos.map((d) => d.id), ['d1'])
})

test('origem que o backend NÃO mediu não recebe número — nem "0"', () => {
  const cards = buildMirrorCards({
    origens: ORIGENS,
    destinos: DESTINOS,
    links: {},
    // Só a primeira está entre as 5 origens com mais movimento.
    topSources: [{ jid: '111@g.us', sent: 112 }],
    todasAsLojas: TODAS,
  })
  assert.equal(cards[0].enviadasHoje, 112)
  assert.equal(cards[1].enviadasHoje, null, 'origem não medida precisa ficar sem número')
  assert.equal(cards[2].enviadasHoje, null)
})

test('origem medida COM zero envio hoje continua dizendo zero', () => {
  // Diferente de "não medido": aqui o backend mediu e o número é 0 mesmo.
  const [card] = buildMirrorCards({
    origens: [ORIGENS[0]],
    destinos: DESTINOS,
    links: {},
    topSources: [{ jid: '111@g.us', sent: 0 }],
    todasAsLojas: TODAS,
  })
  assert.equal(card.enviadasHoje, 0)
})

test('a tela omite o número quando ele não foi medido', () => {
  assert.match(page, /enviadasHoje !== null &&/, 'o cartão precisa esconder o número não medido')
})

test('allowedPlatforms vazio significa TODAS as lojas, nunca nenhuma', () => {
  assert.deepEqual(parseAllowedPlatforms('', TODAS), TODAS)
  assert.deepEqual(parseAllowedPlatforms(null, TODAS), TODAS)
  assert.deepEqual(parseAllowedPlatforms('shopee, amazon', TODAS), ['shopee', 'amazon'])

  const cards = buildMirrorCards({ origens: ORIGENS, destinos: DESTINOS, links: {}, todasAsLojas: TODAS })
  assert.deepEqual(cards[0].lojas, ['shopee', 'amazon'])
  assert.deepEqual(cards[1].lojas, TODAS, 'origem sem filtro precisa mostrar todas as lojas')
})

test('EDITAR remove o destino desmarcado — a união é só de quem está CRIANDO', () => {
  const editar = planMirrorCreation({
    currentPostIds: ['d1', 'd2'],
    currentMode: 'explicit',
    chosenPostIds: ['d1'],
    modo: 'editar',
  })
  assert.deepEqual(editar.postIds, ['d1'], 'editar precisa gravar exatamente o que ficou marcado')
  assert.deepEqual(editar.removidos, ['d2'])

  const criar = planMirrorCreation({
    currentPostIds: ['d1', 'd2'],
    currentMode: 'explicit',
    chosenPostIds: ['d1'],
    modo: 'criar',
  })
  assert.deepEqual(criar.postIds.sort(), ['d1', 'd2'], 'criar continua protegendo o que já existia')
  assert.deepEqual(criar.removidos, [])
})

test('editar até ficar sem destino é permitido, mas avisado', () => {
  // É como a cliente desliga o espelhamento de uma origem. Barrar a tiraria do
  // controle dela; salvar calado a deixaria sem envio sem saber.
  const r = planMirrorCreation({
    currentPostIds: ['d1'],
    currentMode: 'explicit',
    chosenPostIds: [],
    modo: 'editar',
  })
  assert.equal(r.podeSalvar, true)
  assert.equal(r.ficaSemDestino, true)
  assert.deepEqual(r.postIds, [])
  assert.match(page, /ficaSemDestino/, 'a tela precisa avisar antes de salvar sem destino')
})

test('criar continua exigindo pelo menos um destino marcado', () => {
  const r = planMirrorCreation({ currentPostIds: [], chosenPostIds: [], modo: 'criar' })
  assert.equal(r.podeSalvar, false)
  assert.equal(r.ficaSemDestino, false)
})

test('a aba Grupos tem as duas colunas, e cada card abre o painel lateral', () => {
  // Ver no nível 1, configurar no nível 2. A coluna de DESTINOS é o que torna
  // possível absorver a tela de Grupos: sem ela, imagem, marca d'água,
  // boas-vindas, botão "Ver canal" e anti-ban ficam sem porta de entrada.
  assert.match(page, /<GroupColumn/)
  assert.match(page, /title="Grupos que monitoro"/)
  assert.match(page, /title="Meus grupos de promoção"/)
  assert.match(page, /onOpen=\{\(id\) => openDrawerFor\(id, 'monitor'\)\}/)
  assert.match(page, /onOpen=\{\(id\) => openDrawerFor\(id, 'post'\)\}/)
  // Nada de formulário aberto dentro da lista: quem configura é a gaveta.
  assert.match(page, /<GroupDrawer/)
  assert.doesNotMatch(page, /expandedConfigId/, 'a configuração voltou a abrir dentro da lista')
})

test('o cartão da origem continua sendo montado pela regra pura', () => {
  // O cálculo de destinos/lojas/ofertas do dia é o MESMO do cartão de 2026-09-19;
  // reescrevê-lo na tela faria cartão e mapa discordarem sobre a mesma origem.
  assert.match(page, /buildMirrorCards\(\{/)
  assert.match(page, /const originCards = espelhos\.map\(/)
})

test('o cartão NÃO tem interruptor por espelhamento', () => {
  // O backend não tem liga/desliga por vínculo — o que existe é a conexão do
  // WhatsApp (controle mestre no topo). Um interruptor que não desliga nada é
  // pior que nenhum.
  const cartao = page.slice(page.indexOf('function GroupCard('), page.indexOf('function GroupColumn('))
  assert.doesNotMatch(cartao, /type="checkbox"|pnl-switch|role="switch"/, 'interruptor falso no cartão')
})

test('o card inteiro é clicável E tem a engrenagem, com nome acessível', () => {
  // A engrenagem é a MESMA ação do card: ela existe para deixar óbvio que dá
  // para configurar, não como segundo caminho.
  const cartao = page.slice(page.indexOf('function GroupCard('), page.indexOf('function GroupColumn('))
  assert.match(cartao, /className="pnl-esp-card-hit"/)
  assert.match(cartao, /className="pnl-esp-gear"/)
  assert.ok((cartao.match(/aria-label=\{`Configurar \$\{g\.name\}`\}/g) || []).length >= 2)
})

test('no celular as duas colunas viram uma lista só, com seletor', () => {
  // Lado a lado em 375px não cabe: cada coluna ficaria com ~150px e o nome do
  // grupo quebraria letra a letra.
  assert.match(page, /pnl-esp-mobile-switch/)
  assert.match(page, /Origens \(\{monitor\.length\}\)/)
  assert.match(page, /Destinos \(\{post\.length\}\)/)
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'))
  assert.match(mobile, /\.pnl-esp-cols \{ grid-template-columns: 1fr/)
  assert.match(mobile, /\.pnl-esp-mobile-switch \{ display: inline-flex/)
  assert.match(mobile, /\.pnl-esp-col\.is-hidden-mobile \{ display: none/)
})

test('a gaveta vira folha de tela cheia no celular, sem largura fixa', () => {
  // Largura fixa é como um painel nasce fora da área visível em 375px
  // (RCA 2026-09-05, test/dialogos-no-celular.test.js).
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)', css.indexOf('.pnl-drawer {')))
  assert.match(mobile, /\.pnl-drawer \{[^}]*width: 100%/s)
  assert.match(mobile, /\.pnl-drawer-head \{[^}]*position: sticky/s)
  // As abas do painel precisam rolar de lado em vez de espremer.
  assert.match(css, /\.pnl-drawer-tabs \{[^}]*overflow-x: auto/s)
})
