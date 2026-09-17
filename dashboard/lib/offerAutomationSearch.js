// Como a cliente escolhe a busca das ofertas automáticas, em linguagem leiga.
//
// A API de afiliado da Shopee (productOfferV2) sempre aceitou DOIS eixos
// independentes — de qual lista tirar os candidatos e em que ordem devolvê-los
// — e o backend sempre gravou os dois (`OfferAutomation.listType`/`sortType`).
// O que faltava era a TELA: até 2026-09 nenhum dos dois aparecia no formulário,
// então toda automação nascia com o padrão da rota (mais vendidos DENTRO da
// lista de maior comissão) e não havia como a cliente saber disso nem mudar.
//
// Era essa combinação que produzia a queixa: "eletrodoméstico Brastemp" só
// trazia capa de máquina de lavar, "cafeteira dolce gusto" só cápsula
// reutilizável e produto de limpeza, "mesa desmontável" só mesa cavalete.
// Produto caro paga comissão MENOR, então ele é justamente quem a lista de
// maior comissão deixa de fora; o acessório barato de 15% fica. A ordenação
// por mais vendidos já estava ligada — ela só ordenava um conjunto do qual o
// produto procurado nunca fazia parte.
//
// Os números são os da API e não podem aparecer na tela (regra de linguagem
// leiga do AGENTS.md): quem os traduz é este módulo, consumido pelo painel.

export const DEFAULT_SEARCH_POOL = 1
export const DEFAULT_SEARCH_ORDER = 2

// listType da API. `short` é o que cabe na etiqueta do card.
export const SEARCH_POOL_OPTIONS = [
  {
    value: 0,
    short: 'busca ampla',
    label: 'Tudo que combina com a palavra escrita',
    hint: 'Busca mais ampla. É a opção que tem mais chance de trazer o produto em si, e não só os acessórios dele.',
  },
  {
    value: 1,
    short: 'só maior comissão',
    label: 'Só os produtos que pagam mais comissão',
    hint: 'Você ganha mais por venda, mas produto caro costuma pagar comissão menor e acaba ficando de fora — por isso aparece a capa no lugar da máquina.',
  },
  {
    value: 2,
    short: 'só os que mais vendem na Shopee',
    label: 'Só os produtos que mais vendem na Shopee inteira',
    hint: 'Lista bem estreita. Traz campeões de venda, mas pode não achar nada em palavra-chave específica.',
  },
]

// sortType da API.
export const SEARCH_ORDER_OPTIONS = [
  { value: 1, short: 'mais parecidos', label: 'Mais parecidos com o que você escreveu' },
  { value: 2, short: 'mais vendidos', label: 'Mais vendidos primeiro' },
  { value: 5, short: 'maior comissão', label: 'Maior comissão primeiro' },
  { value: 4, short: 'mais baratos', label: 'Mais baratos primeiro' },
  { value: 3, short: 'mais caros', label: 'Mais caros primeiro' },
]

function pick(options, value, fallback) {
  const parsed = Number(value)
  return options.find((option) => option.value === parsed) ?? options.find((option) => option.value === fallback)
}

export function searchPoolOption(value) {
  return pick(SEARCH_POOL_OPTIONS, value, DEFAULT_SEARCH_POOL)
}

export function searchOrderOption(value) {
  return pick(SEARCH_ORDER_OPTIONS, value, DEFAULT_SEARCH_ORDER)
}

// Valor recusado pela API vira o padrão em vez de derrubar a tela: automação
// antiga com campo vazio precisa continuar abrindo para edição.
export function normalizeSearchChoice({ listType, sortType } = {}) {
  return {
    listType: searchPoolOption(listType).value,
    sortType: searchOrderOption(sortType).value,
  }
}

// Uma linha por card, SEMPRE visível. A queixa que originou isto não foi "a
// opção está errada", foi "eu não sabia que existia uma opção" — escondê-la
// quando é o padrão recriaria exatamente esse ponto cego.
export function describeSearchChoice(automation = {}) {
  const pool = searchPoolOption(automation.listType)
  const order = searchOrderOption(automation.sortType)
  return `Busca: ${pool.short} · ${order.short}`
}
