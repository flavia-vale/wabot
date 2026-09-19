/* O que o assistente "Criar novo espelhamento" grava — PURO, sem rede.
 *
 * O assistente liga uma ORIGEM (grupo/canal monitorado) a um ou mais DESTINOS
 * já cadastrados. Ele grava pelo mesmo caminho da tela de grupos
 * (`PUT /api/groups/:id/targets`), e é justamente por isso que a decisão
 * precisa ser explícita aqui:
 *
 * 1. O endpoint SUBSTITUI a lista de destinos da origem. Mandar só o que a
 *    cliente acabou de marcar apagaria, em silêncio, os espelhamentos que ela
 *    já tinha naquela origem. Por isso o assistente sempre manda a UNIÃO.
 *
 * 2. Origem em modo 'all' (nunca escolheu destino) hoje envia para TODOS os
 *    destinos. Salvar uma escolha explícita a tira desse modo — e é uma
 *    mudança de comportamento que a cliente precisa ver ANTES de confirmar,
 *    não descobrir depois com destino que parou de receber (RCA 2026-08-26,
 *    `src/core/destinationRouting.js`).
 */

/**
 * @param {{currentPostIds?: string[], currentMode?: string, chosenPostIds?: string[], allPostIds?: string[]}} params
 * @returns {{postIds: string[], adicionados: string[], jaVinculados: string[], perdeOEnvioParaTodos: string[], podeSalvar: boolean}}
 */
export function planMirrorCreation({
  currentPostIds = [],
  currentMode = 'explicit',
  chosenPostIds = [],
  allPostIds = [],
} = {}) {
  const escolhidos = [...new Set(chosenPostIds.filter(Boolean))]

  // Em modo 'all' a lista devolvida pelo endpoint é o fallback (todos os
  // destinos), não uma escolha da cliente — tratá-la como escolha faria o
  // assistente "confirmar" um vínculo que ela nunca fez. A base da união,
  // nesse caso, é vazia.
  const base = currentMode === 'all' ? [] : [...new Set(currentPostIds.filter(Boolean))]

  const jaVinculados = escolhidos.filter((id) => base.includes(id))
  const adicionados = escolhidos.filter((id) => !base.includes(id))

  // Quem deixa de receber ao sair do modo 'all': os destinos que o fallback
  // cobria e que não foram marcados agora.
  const perdeOEnvioParaTodos = currentMode === 'all'
    ? [...new Set(allPostIds.filter(Boolean))].filter((id) => !escolhidos.includes(id))
    : []

  return {
    postIds: [...base, ...adicionados],
    adicionados,
    jaVinculados,
    perdeOEnvioParaTodos,
    podeSalvar: escolhidos.length > 0,
  }
}

/**
 * A origem que o assistente deve sugerir quando a tela abre, e a que a aba
 * Conexões deve destacar: a PRIMEIRA da lista.
 *
 * A aba Conexões nascia sem nenhuma origem destacada, e o desenho com todas as
 * linhas ao mesmo tempo não se lê. Destacar uma já entrega a leitura pronta.
 * Preserva a escolha da cliente quando ela já selecionou algo, e devolve null
 * quando não há origem (não inventa seleção).
 */
export function resolveInitialOrigin({ origens = [], selecionada = null } = {}) {
  const ids = origens.map((o) => o?.id).filter(Boolean)
  if (selecionada && ids.includes(selecionada)) return selecionada
  return ids[0] ?? null
}
