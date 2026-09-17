// Como a cliente escolhe a ORDEM da busca das ofertas automáticas, em
// linguagem leiga.
//
// A `productOfferV2` da Shopee tem dois eixos — de qual lista tirar os
// candidatos (`listType`) e em que ordem devolvê-los (`sortType`). Até
// 2026-09 nenhum aparecia na tela; em 17/09 os dois apareceram, e a medição
// do mesmo dia mostrou que só um deles importa.
//
// ⚠️ MEDIDO em produção com a chave real (`scripts/diag-busca-shopee.mjs`),
// CINCO palavras-chave, cada uma nas três listas: em todas as cinco as três
// devolveram os MESMOS produtos, na MESMA ordem, na MESMA quantidade. Então a
// lista saiu da tela (segue dormente no banco, decidida em
// `src/offerAutomation/searchListType.js`) e sobrou UMA escolha só — a ordem.
//
// É ela que separa o produto do acessório, e a razão está nos números da mesma
// medição: em "maquina de lavar Brastemp", "mais vendidos" e "maior comissão"
// trazem cinco capas (43% de comissão) e "mais caros primeiro" traz as
// máquinas de verdade (R$ 3.999 a R$ 3.477, comissão 4-7%). O acessório vende
// mais E paga mais — só o preço traz o aparelho.
//
// Os números são os da API e não podem aparecer na tela (regra de linguagem
// leiga do AGENTS.md): quem os traduz é este módulo, consumido pelo painel.

export const DEFAULT_SEARCH_ORDER = 2

// sortType da API. É AQUI que a escolha muda o resultado de verdade.
// sortType da API, com os nomes e a ORDEM da própria documentação da Shopee:
//   1 Relevance · 2 Item Sold · 3 Price from high to low ·
//   4 Price from low to high · 5 Commission from high to low
// Os rótulos são a tradução direta desses nomes — não inventar opção nem
// renomear para "o produto em si": o que a API faz é ordenar por preço, e foi
// a medição que mostrou o efeito disso. Efeito medido vai na dica, nunca no
// rótulo.
export const SEARCH_ORDER_OPTIONS = [
  { value: 1, short: 'relevância', label: 'Relevância', hint: 'Segue o que a Shopee acha mais próximo do texto que você digitou.' },
  { value: 2, short: 'mais vendidos', label: 'Mais vendidos', hint: 'Acessório costuma vender muito mais que o aparelho — é por isso que aqui aparece a cápsula no lugar da cafeteira, e a capa no lugar da máquina.' },
  { value: 3, short: 'maior preço', label: 'Maior preço', hint: 'Medimos: é a opção que traz o aparelho em si em vez do acessório dele. Escolha esta quando estiver aparecendo só capa, cápsula ou peça de reposição.' },
  { value: 4, short: 'menor preço', label: 'Menor preço', hint: 'Traz o que tem menor preço — quase sempre acessório.' },
  { value: 5, short: 'maior comissão', label: 'Maior comissão', hint: 'Você ganha mais por venda, mas o acessório barato é justamente quem paga mais comissão: esta opção traz ainda mais acessório que "Mais vendidos".' },
]

export function searchOrderOption(value) {
  const parsed = Number(value)
  return SEARCH_ORDER_OPTIONS.find((o) => o.value === parsed)
    ?? SEARCH_ORDER_OPTIONS.find((o) => o.value === DEFAULT_SEARCH_ORDER)
}

// Valor recusado pela API vira o padrão em vez de derrubar a tela: automação
// antiga com campo vazio precisa continuar abrindo para edição.
export function normalizeSearchChoice({ sortType } = {}) {
  return { sortType: searchOrderOption(sortType).value }
}

// "Priorizar comissão extra" é LEGADO: automação nova não nasce com ele, mas
// nas que já tinham ele continua valendo — e é por esta etiqueta que a cliente
// descobre que a opção existe e pode ser desligada.
//
// Não é um filtro a mais: é uma SEGUNDA ordem,
// aplicada por cima da que a cliente escolheu. resolveOffers faz duas buscas e
// devolve [...ofertasComComissãoExtra, ...restantes] — cada grupo ordenado pela
// escolha dela, mas a concatenação é quem decide quem sai. Com 1 produto por
// envio, havendo qualquer oferta com comissão extra, é sempre ela que sai:
// "mais baratos primeiro" pode publicar o item de R$500 no lugar do de R$10.
// Por isso o card precisa dizer as duas coisas — dizer só "mais baratos"
// enquanto a comissão extra passa na frente seria mentir na etiqueta.
export function describeSearchChoice(automation = {}) {
  const order = searchOrderOption(automation.sortType)
  const ordem = automation.prioritizeAMS
    ? `comissão extra na frente, depois ${order.short}`
    : order.short
  return `Busca: ${ordem}`
}
