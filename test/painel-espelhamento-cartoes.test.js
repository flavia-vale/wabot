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
  // O seletor precisa APARECER aqui (fora do celular ele é `display: none`).
  // Qual display ele usa é decisão de desenho — em 2026-09-19 virou `flex` de
  // largura total; o teste abaixo, "ocupa a tela toda", é quem trava isso.
  assert.match(mobile, /\.pnl-esp-mobile-switch \{\s*\n?\s*display: (?!none)/)
  assert.match(mobile, /\.pnl-esp-col\.is-hidden-mobile \{ display: none/)
})

test('a gaveta vira folha de tela cheia no celular, sem largura fixa', () => {
  // Largura fixa é como um painel nasce fora da área visível em 375px
  // (RCA 2026-09-05, test/dialogos-no-celular.test.js).
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)', css.indexOf('.pnl-drawer {')))
  assert.match(mobile, /\.pnl-drawer \{[^}]*width: 100%/s)
  // `position: sticky` no cabeçalho SAIU (2026-09-19): ele vive fora do que
  // rola, então nunca grudava em nada — e era o único elemento posicionado
  // ali, o que deixava o empilhamento com surpresa. Quem segura a gaveta hoje
  // é o contrato flex do teste abaixo.
  assert.doesNotMatch(css, /\.pnl-drawer-head \{[^}]*position: sticky/s)
  // As abas do painel precisam rolar de lado em vez de espremer.
  assert.match(css, /\.pnl-drawer-tabs \{[^}]*overflow-x: auto/s)
})

/* ── Celular: o que foi MEDIDO em 375px (2026-09-19) ───────────────────
 * Antes destas regras sobravam 108px para o texto do card — o nome, o
 * "envia para" e as lojas saíam picados em 5 ou 6 linhas, e "Cabeleireira"
 * quebrava no meio. Depois: 215px. Cada asserção abaixo guarda um pedaço
 * dessa medição. */

test('o nome do card tem tamanho próprio e não parte palavra no meio', () => {
  // `overflow-wrap: anywhere` parte a palavra assim que ela não cabe na SOBRA
  // da linha; `break-word` só parte a que sozinha não cabe na linha inteira.
  // E sem `font-size` o nome herdava 16px, maior que o do card antigo.
  assert.match(css, /\.pnl-esp-card-name \{[^}]*font-size: \d/s, 'nome sem tamanho próprio volta a herdar 16px')
  assert.match(css, /\.pnl-esp-card-name \{[^}]*overflow-wrap: break-word/s)
  assert.doesNotMatch(
    css,
    /\.pnl-esp-card-name \{[^}]*overflow-wrap: anywhere/s,
    'anywhere volta a quebrar "Cabeleireir/a" no meio',
  )
})

test('no celular sai a engrenagem e a pílula, não o alvo de toque', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)', css.indexOf('.pnl-esp-card {')))
  // Dois alvos lado a lado em 36px só produzem toque errado: o card inteiro
  // já abre a configuração.
  assert.match(mobile, /\.pnl-esp-gear,\s*\n\s*\.pnl-esp-pill \{ display: none/)
  // A seta entra como sinal visual e NÃO como segundo botão.
  assert.match(mobile, /\.pnl-esp-card-chevron \{ display: inline-flex/)
  const cartao = page.slice(page.indexOf('function GroupCard('), page.indexOf('function GroupColumn('))
  const hit = cartao.slice(cartao.indexOf('pnl-esp-card-hit'), cartao.indexOf('</button>'))
  assert.match(hit, /className="pnl-esp-card-chevron" aria-hidden="true"/, 'a seta precisa viver DENTRO do alvo de toque')
})

test('o cabeçalho da coluna empilha no celular', () => {
  // Em linha, o "+ Adicionar" ficava com ~90px e o rótulo quebrava
  // ("Adicio/nar").
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'))
  assert.match(mobile, /\.pnl-esp-col-head \{[^}]*flex-direction: column/s)
})

test('a linha de fluxo do card é <span>: <div> não vale dentro de <button>', () => {
  const flow = page.slice(page.indexOf('function FlowLine('), page.indexOf('function GroupCard('))
  assert.doesNotMatch(flow, /<div className="pnl-esp-flow"/)
  assert.match(flow, /<span className="pnl-esp-flow"/)
})

test('o corpo da gaveta não pode ser grid — a seção encolhe e corta', () => {
  // `.cfg-section` tem `overflow: hidden`, então o tamanho mínimo automático
  // dela vira zero e num grid de altura definida a linha encolhe. Medido em
  // 375px: a seção de destinos ficava com 257px para 398px de conteúdo e a
  // lista saía cortada no meio de um nome.
  assert.match(css, /\.pnl-drawer-body \{[^}]*display: flex/s)
  assert.doesNotMatch(css, /\.pnl-drawer-body \{[^}]*display: grid/s)
  assert.match(css, /\.pnl-drawer-body > \* \{ flex: 0 0 auto/)
})

test('no celular "Excluir grupo" não fica encostado em "Salvar"', () => {
  // Em linha, a ação que apaga o grupo caía na mesma faixa do polegar que a
  // que salva. `column-reverse` inverte só a pintura — a ordem do DOM (e do
  // leitor de tela) continua Excluir → Salvar.
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)', css.indexOf('.pnl-drawer {')))
  assert.match(mobile, /\.pnl-drawer-foot \{[^}]*flex-direction: column-reverse/s)
})

test('no celular os dois papéis do modal "Adicionar" cabem na tela', () => {
  // Medido em 375px na régua de `.pnl-seg`: 429px de conteúdo para 315px de
  // espaço — "Destino · o robô publica" nascia fora da tela e a pessoa não
  // via que existia uma segunda opção.
  assert.match(page, /className="pnl-seg pnl-esp-add-role"/)
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)', css.indexOf('.pnl-drawer {')))
  assert.match(mobile, /\.pnl-esp-add-role \{[^}]*grid-template-columns: 1fr/s)
})

test('no celular a lista do modal não rola dentro da rolagem do modal', () => {
  // Duas rolagens encaixadas: no toque a de dentro rouba o gesto da de fora.
  assert.match(css, /\.pnl-esp-add-list \{[^}]*max-height: 240px/s, 'o teto continua valendo no computador')
  const mobile = css.slice(css.indexOf('@media (max-width: 560px)', css.indexOf('.pnl-drawer {')))
  assert.match(mobile, /\.pnl-esp-add-list \{ max-height: none/)
})

/* ── Segunda rodada de celular (2026-09-19) ────────────────────────────
 * A cliente fotografou o cabeçalho da gaveta escrito por cima do texto da
 * primeira seção, o "Salvar" do rodapé sem efeito nenhum e o seletor
 * Origens|Destinos pequeno no meio da tela. */

test('a gaveta é coluna flex com as pontas travadas e o meio rolando', () => {
  // Reproduzido em 375x667 impedindo o corpo de rolar: sem estas duas regras
  // o corpo (flex: 1, `min-height: auto`) se recusa a ficar menor que o
  // conteúdo, empurra os irmãos — que encolhem, porque `flex-shrink` nasce 1 —
  // e o texto da primeira seção sobe para dentro das abas e do cabeçalho.
  assert.match(css, /\.pnl-drawer-head,\s*\n\s*\.pnl-drawer-tabs,\s*\n\s*\.pnl-drawer-foot \{ flex-shrink: 0; \}/)
  assert.match(css, /\.pnl-drawer-body \{[^}]*min-height: 0/s)
})

test('botão desligado tem cara de desligado', () => {
  // Sem isto o "Salvar" desligado ficava idêntico ao ligado: a cliente
  // clicava e nada acontecia, sem nenhum sinal do porquê.
  assert.match(css, /\.pnl-btn:disabled[^{]*\{[^}]*opacity/s)
})

test('o "Salvar" da gaveta só desliga enquanto salva, e ao salvar FECHA', () => {
  const gaveta = page.slice(page.indexOf('function GroupDrawer('), page.indexOf('function AddGroupModal('))
  assert.match(gaveta, /onClick=\{onSave\} disabled=\{saving\}/, 'o botão não pode voltar a desligar por "nada mudou"')
  assert.doesNotMatch(gaveta, /disabled=\{!dirty/)

  const salvar = page.slice(page.indexOf('async function handleDrawerSave()'), page.indexOf('async function handleLoadWA()'))
  assert.match(salvar, /setDrawerId\(null\)/, 'salvar precisa fechar a gaveta')
  // Fechar por cima de um erro esconderia que nada foi para o servidor.
  assert.match(salvar, /if \(ok === false\) return/)
})

test('a aba "Anti-ban" saiu do destino e a saúde do canal ficou', () => {
  const abas = page.slice(page.indexOf('const DEST_TABS'), page.indexOf('const GRADIENTS'))
  assert.doesNotMatch(abas, /antiban|Anti-ban/)
  assert.match(abas, /key: 'imagem'/)
  assert.match(abas, /key: 'mensagens'/)
  // O painel de saúde do canal é configuração de verdade — não pode sumir junto.
  assert.match(page, /<ChannelHealthPanel/)
  // Aba desconhecida (a antiga, guardada no estado) não pode abrir em branco.
  assert.match(page, /const drawerTabSafe = drawerTabs\.some/)
})

test('no celular o seletor Origens|Destinos ocupa a tela toda', () => {
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'))
  const bloco = mobile.slice(mobile.indexOf('.pnl-esp-mobile-switch {'))
  assert.match(bloco, /width: 100%/)
  assert.doesNotMatch(bloco.slice(0, bloco.indexOf('}')), /display: inline-flex/)
  // Alvo de toque: como régua de 26px ele era enfeite, não navegação.
  assert.match(mobile, /\.pnl-esp-mobile-switch button \{[^}]*min-height: 44px/s)
})

test('a janela "Adicionar" tem cabeçalho preso e corpo rolando', () => {
  // Com a lista de grupos do WhatsApp inteira dentro dela, era o modal todo
  // que rolava: o título e o "fechar" saíam da tela. Medido em 375px com 10
  // grupos — depois de rolar 662px o cabeçalho continua em y12.
  assert.match(page, /className="pnl-esp-add-head"/)
  assert.match(page, /className="pnl-esp-add-body"/)
  assert.match(css, /\.pnl-esp-add \{[^}]*flex-direction: column/s)
  assert.match(css, /\.pnl-esp-add \{[^}]*overflow: hidden/s)
  // Mesma receita da gaveta: ponta travada, meio podendo encolher até zero.
  assert.match(css, /\.pnl-esp-add-head \{[^}]*flex-shrink: 0/s)
  assert.match(css, /\.pnl-esp-add-body \{[^}]*min-height: 0/s)
  assert.match(css, /\.pnl-esp-add-body \{[^}]*overflow-y: auto/s)
})

test('janela alta no celular respeita a barra do navegador', () => {
  // `100vh` e o `inset: 0` de um elemento fixo NÃO descontam a barra de
  // endereço nem a barra de baixo: a janela nasce por baixo delas e o título
  // fica ilegível. `dvh` desconta. Navegador sem suporte ignora a linha, por
  // isso a versão em `vh` fica antes, como plano B.
  assert.match(css, /\.pnl-modal-overlay \{ height: 100dvh; \}/)
  assert.match(css, /\.pnl-drawer-overlay \{ height: 100dvh; \}/)
  assert.match(css, /\.pnl-esp-add \{[^}]*max-height: calc\(100vh - 40px\);[^}]*max-height: calc\(100dvh - 40px\)/s)
})
