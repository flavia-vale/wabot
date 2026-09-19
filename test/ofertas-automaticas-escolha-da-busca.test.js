import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  SEARCH_ORDER_OPTIONS,
  DEFAULT_SEARCH_ORDER,
  searchOrderOption,
  normalizeSearchChoice,
  describeSearchChoice,
} from '../dashboard/lib/offerAutomationSearch.js'
import { resolveOffers } from '../src/offerAutomation/dispatcher.js'
import { resolveSearchListType, DEFAULT_SEARCH_LIST_TYPE } from '../src/offerAutomation/searchListType.js'

const page = () => readFile(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')

test('as opções cobrem exatamente o que a API aceita, sem inventar valor', () => {
  // src/api/routes/offerAutomation.js: VALID_SORT_TYPES [1..5].
  assert.deepEqual(SEARCH_ORDER_OPTIONS.map(o => o.value).sort(), [1, 2, 3, 4, 5])
})

test('a ordem padrão continua a que já estava gravada', () => {
  // Prisma: sortType @default(2). Mudar isto mudaria a busca de toda automação
  // nova sem ninguém ter pedido.
  assert.equal(DEFAULT_SEARCH_ORDER, 2)
})

test('a lista é decidida em UM lugar e o valor gravado é ignorado', () => {
  // CINCO palavras-chave medidas em produção (2026-09-17): as três listas
  // devolveram os mesmos produtos, na mesma ordem, na mesma quantidade.
  // 0 é o único valor que a Shopee documenta; o histórico 1 não aparece na
  // documentação dela em lugar nenhum.
  assert.equal(DEFAULT_SEARCH_LIST_TYPE, 0)
  assert.equal(resolveSearchListType(undefined), 0)
  assert.equal(resolveSearchListType(''), 0)
  // Escape hatch: volta ao histórico sem deploy.
  assert.equal(resolveSearchListType('1'), 1)
  // `.env` mal preenchido nunca pode derrubar a busca de todo mundo.
  assert.equal(resolveSearchListType('banana'), 0)
  assert.equal(resolveSearchListType('9'), 0)
  assert.equal(resolveSearchListType('1.5'), 0)
})

test('a escolha da cliente NÃO decide mais a lista', async () => {
  // Chokepoint único: automação com listType gravado continua buscando na
  // lista resolvida pelo módulo, não na gravada.
  const chamadas = []
  await resolveOffers({
    automation: { keyword: 'x', minDiscountPct: 0, offersPerSend: 1, listType: 2, sortType: 3, prioritizeAMS: false },
    sentItemIds: [],
    creds: { appId: 'a', secretKey: 'b' },
    fetchOffersFn: async (args) => { chamadas.push(args); return { offers: [], rawCount: 0 } },
  })
  assert.equal(chamadas[0].listType, resolveSearchListType())
  assert.equal(chamadas[0].sortType, 3)
})

test('o dispatcher não pode voltar a ler a lista gravada na automação', async () => {
  const source = await readFile(new URL('../src/offerAutomation/dispatcher.js', import.meta.url), 'utf8')
  const codigo = source.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(codigo, /automation\.listType/)
  assert.match(source, /resolveSearchListType\(\)/)
})

test('valor inválido ou ausente cai no padrão em vez de derrubar a tela', () => {
  assert.deepEqual(normalizeSearchChoice({}), { sortType: 2 })
  assert.deepEqual(normalizeSearchChoice({ sortType: null }), { sortType: 2 })
  assert.deepEqual(normalizeSearchChoice({ sortType: 99 }), { sortType: 2 })
  assert.deepEqual(normalizeSearchChoice({ sortType: '5' }), { sortType: 5 })
})

test('a busca escolhida aparece SEMPRE no card, inclusive quando é o padrão', () => {
  // A queixa que originou isto não foi "a opção está errada", foi "eu não
  // sabia que existia" — esconder no padrão recria o mesmo ponto cego.
  assert.equal(describeSearchChoice({ sortType: 2 }), 'Busca: mais vendidos')
  assert.equal(describeSearchChoice({ sortType: 3 }), 'Busca: maior preço')
  assert.equal(describeSearchChoice({}), 'Busca: mais vendidos')
})

test('nenhum jargão chega à tela', () => {
  const texto = [...SEARCH_ORDER_OPTIONS]
    .flatMap(o => [o.label, o.short, o.hint ?? ''])
    .join(' ')
    .toLowerCase()
  for (const jargao of ['sorttype', 'listtype', 'productofferv2', 'api', 'graphql', 'keyword', 'query']) {
    assert.ok(!texto.includes(jargao), `jargão na tela: ${jargao}`)
  }
})

test('a dica que resolve a queixa mora na ORDEM, não na lista', () => {
  // MEDIDO em produção (2026-09-17): "maquina de lavar Brastemp" com "mais
  // caros primeiro" devolve as máquinas de verdade (R$ 3.999 a R$ 3.477);
  // com "maior comissão" devolve cinco capas de 43%. É esta a escolha que
  // separa o produto do acessório — e é nela que a cliente precisa esbarrar.
  assert.match(searchOrderOption(3).hint, /aparelho/i)
  assert.match(searchOrderOption(2).hint, /acess[óo]rio/i)
  assert.match(searchOrderOption(5).hint, /acess[óo]rio/i)
  assert.equal(searchOrderOption(2).short, 'mais vendidos')
  assert.equal(searchOrderOption(3).short, 'maior preço')
  // Os rótulos são os nomes da documentação da Shopee, traduzidos, na ordem
  // dela — não invenção nossa. Efeito medido mora na dica.
  assert.deepEqual(SEARCH_ORDER_OPTIONS.map(o => o.value), [1, 2, 3, 4, 5])
  assert.deepEqual(SEARCH_ORDER_OPTIONS.map(o => o.label), ['Relevância', 'Mais vendidos', 'Maior preço', 'Menor preço', 'Maior comissão'])
})

test('a lista saiu da tela e não pode voltar sem medição nova', async () => {
  // Cinco palavras-chave, três listas cada, resultado idêntico nas cinco. Um
  // campo que não muda o resultado desvia a cliente da ordem, que é o que
  // resolve — e prometer filtro ali ("só maior comissão") é mentira medida.
  const source = await page()
  assert.doesNotMatch(source, /SEARCH_POOL_OPTIONS/)
  assert.doesNotMatch(source, /listType/)
  const modulo = await readFile(new URL('../dashboard/lib/offerAutomationSearch.js', import.meta.url), 'utf8')
  assert.doesNotMatch(modulo.split('\n').filter(l => !l.trim().startsWith('//')).join('\n'), /SEARCH_POOL_OPTIONS/)
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

test('o formulário oferece UMA escolha e a carrega ao editar', async () => {
  const source = await page()
  assert.match(source, /O que você quer que apareça primeiro\?/)
  assert.match(source, /SEARCH_ORDER_OPTIONS\.map/)
  // A dica é a da opção ESCOLHIDA, não uma frase fixa.
  assert.match(source, /searchOrderOption\(form\.sortType\)\.hint/)
  // Sem isto, abrir "Editar" reverteria a escolha salva para o padrão.
  assert.match(source, /\.\.\.normalizeSearchChoice\(a\)/)
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
  assert.equal(describeSearchChoice({ sortType: 4 }), 'Busca: menor preço')
  assert.equal(
    describeSearchChoice({ sortType: 4, prioritizeAMS: true }),
    'Busca: comissão extra na frente, depois menor preço',
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
