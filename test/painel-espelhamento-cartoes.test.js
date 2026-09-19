/* Guarda do cartão de UM espelhamento (2026-09-19).
 *
 * A aba Grupos mostrava duas COLUNAS — "grupos que monitoro" e "meus grupos de
 * promoção" — e quem lia precisava cruzar as duas na cabeça para responder a
 * única pergunta que importa ali: "esta origem publica onde?". Agora é um
 * cartão por ORIGEM, na horizontal: LÊ DE → PUBLICA EM.
 *
 * As três formas de o cartão mentir, todas cobertas aqui:
 *
 * 1. escrever "0 ofertas hoje" para origem que o backend NÃO mediu
 *    (`GET /logs/summary` devolve só as 5 origens com mais movimento);
 * 2. mostrar origem sem loja nenhuma — `allowedPlatforms` vazio significa
 *    TODAS, é como a tela de grupos já lê o campo;
 * 3. o botão "Editar" não conseguir REMOVER um destino, porque o assistente
 *    soma (correto ao criar, errado ao editar).
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

test('a aba Grupos renderiza os cartões, não as duas colunas antigas', () => {
  assert.match(page, /espelhos\.map\(/, 'a lista de cartões sumiu do render')
  assert.match(page, /<EspelhoCard/)
  assert.doesNotMatch(page, /<GroupList/, 'as duas colunas verticais voltaram')
  assert.match(page, /onEditar=\{editarEspelho\}/, '"Editar" precisa reabrir o assistente')
})

test('o cartão NÃO tem interruptor por espelhamento', () => {
  // O backend não tem liga/desliga por vínculo — o que existe é a conexão do
  // WhatsApp (controle mestre no topo). Um interruptor que não desliga nada é
  // pior que nenhum.
  const cartao = page.slice(page.indexOf('function EspelhoCard'), page.indexOf('const ROW_H'))
  assert.doesNotMatch(cartao, /type="checkbox"|pnl-switch|role="switch"/, 'interruptor falso no cartão')
})

test('o cartão vira uma coluna no celular, com a seta deitada', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 640px)'))
  assert.match(mobile, /\.esp-card-corpo \{ grid-template-columns: 1fr/)
  assert.match(mobile, /\.esp-seta \{ transform: rotate\(90deg\)/)
})
