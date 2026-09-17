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

test('quem JÁ tem comissão extra ligada continua enviando igual', async () => {
  // A opção saiu da tela, mas não pode sair do envio: automação que já estava
  // com ela precisa entregar exatamente o que entregava antes, senão o robô
  // dessas contas muda sozinho no deploy.
  const catalogo = {
    ams: [{ itemId: 1, productName: 'Acessório com comissão extra', price: 500, priceDiscountRate: 50 }],
    normal: [{ itemId: 2, productName: 'Produto barato', price: 10, priceDiscountRate: 50 }],
  }
  const buscar = async (args) => {
    const pool = args.isAMSOffer ? catalogo.ams : catalogo.normal
    const excl = new Set((args.excludeItemIds ?? []).map(String))
    const offers = pool.filter(o => !excl.has(String(o.itemId)))
    return { offers, rawCount: offers.length }
  }
  const rodar = (prioritizeAMS) => resolveOffers({
    automation: { keyword: 'x', minDiscountPct: 0, offersPerSend: 1, sortType: 4, listType: 0, page: 1, prioritizeAMS },
    sentItemIds: [], creds: {}, fetchOffersFn: buscar,
  })

  const comOpcao = await rodar(true)
  assert.equal(comOpcao.offers[0].productName, 'Acessório com comissão extra')

  // E quem NUNCA marcou também não muda: uma busca só, na ordem escolhida.
  const semOpcao = await rodar(false)
  assert.equal(semOpcao.offers[0].productName, 'Produto barato')
})

test('as duas buscas do legado saem com a MESMA escolha da cliente', async () => {
  const chamadas = []
  await resolveOffers({
    automation: { keyword: 'x', minDiscountPct: 0, offersPerSend: 1, sortType: 5, listType: 0, page: 1, prioritizeAMS: true },
    sentItemIds: [], creds: {},
    fetchOffersFn: async (args) => { chamadas.push(args); return { offers: [], rawCount: 0 } },
  })
  assert.equal(chamadas.length, 2)
  assert.deepEqual(chamadas.map(c => c.isAMSOffer), [true, false])
  for (const chamada of chamadas) {
    assert.equal(chamada.listType, 0)
    assert.equal(chamada.sortType, 5)
  }
})

test('o card continua dizendo quando a comissão extra fura a ordem', () => {
  assert.equal(describeSearchChoice({ listType: 0, sortType: 4 }), 'Busca: busca ampla · mais baratos')
  assert.equal(
    describeSearchChoice({ listType: 0, sortType: 4, prioritizeAMS: true }),
    'Busca: busca ampla · comissão extra na frente, depois mais baratos',
  )
})

test('automação NOVA nunca nasce com a comissão extra ligada', async () => {
  const source = await page()
  // O campo não pode estar no formulário vazio: é isso que faz o POST gravar
  // false e a opção deixar de existir para quem chega agora.
  const emptyForm = source.slice(source.indexOf('const emptyForm = {'), source.indexOf('function nextSendLabel'))
  assert.doesNotMatch(emptyForm, /prioritizeAMS/)
})

test('o controle só aparece para desligar, nunca para ligar', async () => {
  const source = await page()
  // Renderizado sob a condição de já estar ligado, e o clique só escreve false.
  assert.match(source, /\{form\.prioritizeAMS && \(/)
  assert.match(source, /onChange=\{\(\) => setForm\(\(f\) => \(\{ \.\.\.f, prioritizeAMS: false \}\)\)\}/)
  assert.doesNotMatch(source, /prioritizeAMS: e\.target\.checked/)
  // Ao editar, precisa carregar o valor salvo — sem isso o checkbox nunca
  // apareceria para quem tem a opção, e ela ficaria presa nela.
  assert.match(source, /prioritizeAMS: a\.prioritizeAMS \?\? false/)
  assert.match(source, /opção antiga/i)
})
