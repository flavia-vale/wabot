// Filtros por motivo da caixa "Hoje" (/admin/hoje?motivo=...).
//
// Substituem os filtros de cenário da antiga aba Online (G2 fecha o corte do
// Início): cada grupo reúne os motivos de src/domain/admin/inboxPriority.js
// (GRAVIDADE) que respondem à mesma pergunta da dona. Função pura, sem
// dependência — o teste importa direto.

export const FILTROS_MOTIVO = Object.freeze([
  { chave: 'robo', rotulo: 'Robô caído', motivos: ['robo-caido-agora', 'robo-caido'] },
  { chave: 'cega', rotulo: 'Sem receber', motivos: ['cega-agora'] },
  { chave: 'chave', rotulo: 'Chave de loja', motivos: ['chave-de-loja'] },
  { chave: 'cobranca', rotulo: 'Cobrança', motivos: ['cobranca-recusada'] },
  { chave: 'vencendo', rotulo: 'Vencendo', motivos: ['vence-em-breve', 'venceu-ate-3d', 'venceu-4-a-20d', 'venceu-mais-20d'] },
  { chave: 'sem-envio', rotulo: 'Sem envio', motivos: ['parou-de-enviar', 'sem-envio-ate-7d', 'sem-envio-8-a-20d', 'sem-loja'] },
])

export function filtroPorChave(chave) {
  return FILTROS_MOTIVO.find(f => f.chave === chave) ?? null
}

/** Chave desconhecida ou vazia = sem filtro (mostra tudo). */
export function filtrarPorMotivo(itens, chave) {
  const filtro = filtroPorChave(chave)
  const lista = Array.isArray(itens) ? itens : []
  if (!filtro) return lista
  return lista.filter(item => filtro.motivos.includes(item.motivo))
}

// Faixas de gravidade da caixa "Hoje" (DS v2.1, seção Admin, bloco 4). Uma faixa
// por grupo de GRAVIDADE de src/domain/admin/inboxPriority.js; a cor nunca vem
// sozinha (o título do motivo continua escrito). test/admin-tokens-ds.test.js
// confere que todo motivo de GRAVIDADE cai na faixa certa. Cores só por token.
export const FAIXAS_GRAVIDADE = Object.freeze({
  3: { rotulo: 'Receita parando', cor: 'var(--danger)', fundo: 'color-mix(in srgb, var(--danger) 22%, var(--surface))' },
  2: { rotulo: 'Vai parar logo', cor: 'var(--warn)', fundo: 'color-mix(in srgb, var(--warn) 24%, var(--surface))' },
  1: { rotulo: 'Vale conversar', cor: 'var(--accent-3)', fundo: 'var(--accent-3)' },
  0: { rotulo: 'Funil', cor: 'var(--line)', fundo: 'var(--bg-soft)' },
})

export const FAIXA_POR_MOTIVO = Object.freeze({
  'robo-caido-agora': 3,
  'cega-agora': 3,
  'cobranca-recusada': 3,
  'chave-de-loja': 2,
  'robo-caido': 2,
  'parou-de-enviar': 2,
  'sem-loja': 2,
  'vence-em-breve': 1,
  'venceu-ate-3d': 1,
  'venceu-4-a-20d': 1,
  'venceu-mais-20d': 0,
  'sem-envio-ate-7d': 0,
  'sem-envio-8-a-20d': 0,
})

/** Faixa de cor do motivo; motivo desconhecido = faixa neutra (Funil). */
export function faixaDoMotivo(motivo) {
  return FAIXAS_GRAVIDADE[FAIXA_POR_MOTIVO[motivo] ?? 0]
}

export function contarPorFiltro(itens) {
  const lista = Array.isArray(itens) ? itens : []
  return Object.fromEntries(FILTROS_MOTIVO.map(f => [f.chave, lista.filter(i => f.motivos.includes(i.motivo)).length]))
}
