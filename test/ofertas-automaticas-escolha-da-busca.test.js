import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  SEARCH_POOL_OPTIONS,
  SEARCH_ORDER_OPTIONS,
  DEFAULT_SEARCH_POOL,
  DEFAULT_SEARCH_ORDER,
  searchPoolOption,
  searchOrderOption,
  normalizeSearchChoice,
  describeSearchChoice,
} from '../dashboard/lib/offerAutomationSearch.js'
import { resolveOffers } from '../src/offerAutomation/dispatcher.js'

const page = () => readFile(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')

test('as opções cobrem exatamente o que a API aceita, sem inventar valor', () => {
  // src/api/routes/offerAutomation.js: VALID_LIST_TYPES [0,1,2], VALID_SORT_TYPES [1..5].
  assert.deepEqual(SEARCH_POOL_OPTIONS.map(o => o.value).sort(), [0, 1, 2])
  assert.deepEqual(SEARCH_ORDER_OPTIONS.map(o => o.value).sort(), [1, 2, 3, 4, 5])
})

test('o padrão continua o que já estava gravado — ninguém tem a busca trocada em silêncio', () => {
  // Prisma: sortType @default(2), listType @default(1). Mudar isto aqui mudaria
  // a busca de toda automação nova sem ninguém ter pedido.
  assert.equal(DEFAULT_SEARCH_POOL, 1)
  assert.equal(DEFAULT_SEARCH_ORDER, 2)
})

test('valor inválido ou ausente cai no padrão em vez de derrubar a tela', () => {
  assert.deepEqual(normalizeSearchChoice({}), { listType: 1, sortType: 2 })
  assert.deepEqual(normalizeSearchChoice({ listType: 99, sortType: null }), { listType: 1, sortType: 2 })
  assert.deepEqual(normalizeSearchChoice({ listType: '0', sortType: '5' }), { listType: 0, sortType: 5 })
})

test('a busca escolhida aparece SEMPRE no card, inclusive quando é o padrão', () => {
  // A queixa que originou isto não foi "a opção está errada", foi "eu não
  // sabia que existia" — esconder no padrão recria o mesmo ponto cego.
  assert.equal(describeSearchChoice({ listType: 1, sortType: 2 }), 'Busca: só maior comissão · mais vendidos')
  assert.equal(describeSearchChoice({ listType: 0, sortType: 2 }), 'Busca: busca ampla · mais vendidos')
  assert.equal(describeSearchChoice({}), 'Busca: só maior comissão · mais vendidos')
})

test('nenhum jargão chega à tela', () => {
  const texto = [...SEARCH_POOL_OPTIONS, ...SEARCH_ORDER_OPTIONS]
    .flatMap(o => [o.label, o.short, o.hint ?? ''])
    .join(' ')
    .toLowerCase()
  for (const jargao of ['sorttype', 'listtype', 'productofferv2', 'api', 'graphql', 'keyword', 'query']) {
    assert.ok(!texto.includes(jargao), `jargão na tela: ${jargao}`)
  }
})

test('a opção de maior comissão avisa que é ela quem deixa o produto caro de fora', () => {
  // É a causa da queixa: produto caro paga comissão menor, então some da lista
  // de maior comissão e sobra o acessório barato. Sem o aviso, a cliente troca
  // a palavra-chave para sempre sem nunca chegar no que estava filtrando.
  assert.match(searchPoolOption(1).hint, /comissão menor/i)
  assert.match(searchPoolOption(0).hint, /ampla/i)
  assert.equal(searchOrderOption(2).short, 'mais vendidos')
})

test('a escolha da cliente chega à busca da Shopee', async () => {
  const chamadas = []
  await resolveOffers({
    automation: { keyword: 'cafeteira dolce gusto', minDiscountPct: 0, offersPerSend: 1, listType: 0, sortType: 5, page: 3, prioritizeAMS: false },
    sentItemIds: [],
    creds: { appId: 'a', secretKey: 'b' },
    fetchOffersFn: async (args) => { chamadas.push(args); return { offers: [], rawCount: 0 } },
  })
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].listType, 0)
  assert.equal(chamadas[0].sortType, 5)
})

test('a fila de revisão não pode mais forçar uma ordem por cima da escolha', async () => {
  const source = await readFile(new URL('../src/offerAutomation/reviewDiscoveryService.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /sortType:\s*\d/)
})

test('o formulário oferece as duas escolhas e as carrega ao editar', async () => {
  const source = await page()
  assert.match(source, /Quais produtos o robô pode trazer\?/)
  assert.match(source, /Qual vem primeiro\?/)
  assert.match(source, /SEARCH_POOL_OPTIONS\.map/)
  assert.match(source, /SEARCH_ORDER_OPTIONS\.map/)
  // Sem isto, abrir "Editar" reverteria a escolha salva para o padrão.
  assert.match(source, /\.\.\.normalizeSearchChoice\(a\)/)
  assert.match(source, /listType: DEFAULT_SEARCH_POOL/)
  assert.match(source, /sortType: DEFAULT_SEARCH_ORDER/)
  assert.match(source, /\{describeSearchChoice\(a\)\}/)
})

test('a prioridade de comissão extra ficou dormente e não muda mais a ordem', async () => {
  // Ela fazia uma SEGUNDA busca e devolvia [...comissãoExtra, ...restantes]:
  // com 1 produto por envio e "mais baratos primeiro" escolhido, saía o item de
  // R$500 no lugar do de R$10. O botão saiu da tela a pedido da dona do produto
  // (a ordem "maior comissão primeiro" cobre a mesma intenção, de um jeito
  // visível), então o campo precisa parar de agir junto — mantê-lo valendo sem
  // botão seria o mesmo efeito invisível de antes.
  const catalogo = {
    ams: [{ itemId: 1, productName: 'Acessório com comissão extra', price: 500, priceDiscountRate: 50 }],
    normal: [{ itemId: 2, productName: 'Produto barato', price: 10, priceDiscountRate: 50 }],
  }
  const chamadas = []
  const buscar = async (args) => {
    chamadas.push(args.isAMSOffer)
    const pool = args.isAMSOffer ? catalogo.ams : catalogo.normal
    return { offers: pool, rawCount: pool.length }
  }
  const { offers } = await resolveOffers({
    automation: { keyword: 'x', minDiscountPct: 0, offersPerSend: 1, sortType: 4, listType: 0, page: 1, prioritizeAMS: true },
    sentItemIds: [], creds: {}, fetchOffersFn: buscar,
  })
  assert.deepEqual(chamadas, [false])
  assert.equal(offers[0].productName, 'Produto barato')
})

test('a busca continua saindo com a escolha da cliente', async () => {
  const chamadas = []
  await resolveOffers({
    automation: { keyword: 'x', minDiscountPct: 0, offersPerSend: 1, sortType: 5, listType: 0, page: 1, prioritizeAMS: true },
    sentItemIds: [], creds: {},
    fetchOffersFn: async (args) => { chamadas.push(args); return { offers: [], rawCount: 0 } },
  })
  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].listType, 0)
  assert.equal(chamadas[0].sortType, 5)
})

test('o card descreve só a busca escolhida, sem citar comissão extra', () => {
  assert.equal(describeSearchChoice({ listType: 0, sortType: 4 }), 'Busca: busca ampla · mais baratos')
  // Campo dormente não pode voltar a aparecer na etiqueta: o card mentiria
  // sobre um efeito que o robô não aplica mais.
  assert.equal(describeSearchChoice({ listType: 0, sortType: 4, prioritizeAMS: true }), 'Busca: busca ampla · mais baratos')
})

test('o botão de comissão extra saiu da tela', async () => {
  const source = await page()
  assert.doesNotMatch(source, /prioritizeAMS/)
  assert.doesNotMatch(source, /comissão extra/i)
  // A ordem escolhida é agora a única forma de pedir comissão primeiro.
  assert.ok(SEARCH_ORDER_OPTIONS.some((o) => o.value === 5 && /comissão/i.test(o.label)))
})

test('nenhum caminho de busca faz a segunda chamada de comissão extra', async () => {
  const source = await readFile(new URL('../src/offerAutomation/dispatcher.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /isAMSOffer:\s*true/)
})
