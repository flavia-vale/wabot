// Como a cliente escolhe a busca das ofertas automáticas, em linguagem leiga.
//
// A API de afiliado da Shopee (productOfferV2) aceita DOIS eixos — de qual
// lista tirar os candidatos (`listType`) e em que ordem devolvê-los
// (`sortType`). O backend sempre gravou os dois; até 2026-09 nenhum aparecia
// na tela, então toda automação nascia com o padrão da rota e a cliente não
// tinha como saber que existia escolha.
//
// ⚠️ MEDIDO EM PRODUÇÃO (2026-09-17, `scripts/diag-busca-shopee.mjs`, chave
// real): para "eletrodoméstico Brastemp", as TRÊS listas devolveram os MESMOS
// 50 produtos, na MESMA ordem. `listType` não filtrou nada. A explicação que
// este arquivo trazia antes — "a lista de maior comissão deixa o produto caro
// de fora" — era hipótese e foi DERRUBADA pela medição. Não repetir.
//
// O que de fato separa o produto do acessório é a ORDEM, e a razão está nos
// números da mesma medição ("cafeteira dolce gusto"): cápsula reutilizável
// paga 23% de comissão e vende muito; a cafeteira paga 3%. Então tanto "mais
// vendidos" quanto "maior comissão" empurram o acessório para cima — só
// "mais caros primeiro" fez as cafeteiras de verdade (R$ 995 a R$ 1.422)
// aparecerem. É essa a dica que a cliente precisa ler, e por isso ela mora na
// ORDEM, não na lista.
//
// Os números são os da API e não podem aparecer na tela (regra de linguagem
// leiga do AGENTS.md): quem os traduz é este módulo, consumido pelo painel.

export const DEFAULT_SEARCH_POOL = 1
export const DEFAULT_SEARCH_ORDER = 2

// listType da API. `short` é o que cabe na etiqueta do card.
//
// Os rótulos NÃO prometem filtro, porque a medição mostrou que ele não
// acontece: prometer "só maior comissão" enquanto a Shopee devolve a mesma
// lista faz a cliente mexer aqui em vez de mexer na ordem, que é o que
// resolve. O campo continua na tela porque a medição cobriu duas
// palavras-chave, não todas — mas ele deixou de ser apresentado como saída.
export const SEARCH_POOL_OPTIONS = [
  {
    value: 0,
    short: 'lista ampla',
    label: 'Lista ampla da Shopee',
    hint: 'Nas buscas que medimos, as três listas devolveram os mesmos produtos. Se a busca não está trazendo o que você quer, mexa primeiro em "Qual vem primeiro" — é ali que a diferença aparece.',
  },
  {
    value: 1,
    short: 'lista padrão',
    label: 'Lista padrão da Shopee',
    hint: 'É a lista que todas as automações usam desde sempre. Nas buscas que medimos ela devolveu o mesmo que as outras duas.',
  },
  {
    value: 2,
    short: 'lista de destaques',
    label: 'Lista de destaques da Shopee',
    hint: 'A Shopee descreve como lista de destaque. Nas buscas que medimos ela devolveu o mesmo que as outras duas, e em palavra-chave específica pode não achar nada.',
  },
]

// sortType da API. É AQUI que a escolha muda o resultado de verdade.
export const SEARCH_ORDER_OPTIONS = [
  { value: 1, short: 'mais parecidos', label: 'Mais parecidos com o que você escreveu', hint: 'Segue o que a Shopee acha mais próximo do texto que você digitou.' },
  { value: 2, short: 'mais vendidos', label: 'Mais vendidos primeiro', hint: 'Acessório costuma vender muito mais que o aparelho — é por isso que aqui aparece a cápsula no lugar da cafeteira, e a capa no lugar da máquina.' },
  { value: 5, short: 'maior comissão', label: 'Maior comissão primeiro', hint: 'Você ganha mais por venda, mas o acessório barato é justamente quem paga mais comissão: esta opção traz ainda mais acessório que a de cima.' },
  { value: 4, short: 'mais baratos', label: 'Mais baratos primeiro', hint: 'Traz o que tem menor preço — quase sempre acessório.' },
  { value: 3, short: 'mais caros', label: 'Mais caros primeiro', hint: 'É a opção que traz o APARELHO em si em vez do acessório dele. Escolha esta quando estiver aparecendo só capa, cápsula ou peça de reposição.' },
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
  const pool = searchPoolOption(automation.listType)
  const order = searchOrderOption(automation.sortType)
  const ordem = automation.prioritizeAMS
    ? `comissão extra na frente, depois ${order.short}`
    : order.short
  return `Busca: ${pool.short} · ${ordem}`
}
