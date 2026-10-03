// Filtros por motivo da caixa "Hoje" (/admin/hoje?motivo=...).
//
// Substituem os filtros de cenário da antiga aba Online (G2 fecha o corte do
// Início): cada grupo reúne os motivos de src/domain/admin/inboxPriority.js
// (GRAVIDADE) que respondem à mesma pergunta da dona. Função pura, sem
// dependência — o teste importa direto.

export const FILTROS_MOTIVO = Object.freeze([
  { chave: 'robo', rotulo: 'Robô caído', motivos: ['robo-caido-agora', 'robo-caido'] },
  { chave: 'cega', rotulo: 'Sem receber', motivos: ['cega-agora'] },
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

export function contarPorFiltro(itens) {
  const lista = Array.isArray(itens) ? itens : []
  return Object.fromEntries(FILTROS_MOTIVO.map(f => [f.chave, lista.filter(i => f.motivos.includes(i.motivo)).length]))
}
