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
 * @returns {{postIds: string[], adicionados: string[], jaVinculados: string[], removidos: string[], perdeOEnvioParaTodos: string[], podeSalvar: boolean, ficaSemDestino: boolean}}
 */
export function planMirrorCreation({
  currentPostIds = [],
  currentMode = 'explicit',
  chosenPostIds = [],
  allPostIds = [],
  modo = 'criar',
} = {}) {
  const escolhidos = [...new Set(chosenPostIds.filter(Boolean))]

  /* Editar é diferente de criar. Ao EDITAR, a tela abre com os destinos atuais
   * já marcados, então desmarcar é uma remoção deliberada — a união apagaria
   * essa intenção e o botão "Editar" nunca conseguiria tirar um destino. Ao
   * CRIAR, a cliente parte do zero e não está decidindo sobre o que já existe:
   * ali a união é o que protege os vínculos antigos. */
  if (modo === 'editar') {
    const atuais = currentMode === 'all' ? [] : [...new Set(currentPostIds.filter(Boolean))]
    return {
      postIds: escolhidos,
      adicionados: escolhidos.filter((id) => !atuais.includes(id)),
      jaVinculados: escolhidos.filter((id) => atuais.includes(id)),
      removidos: atuais.filter((id) => !escolhidos.includes(id)),
      perdeOEnvioParaTodos: currentMode === 'all'
        ? [...new Set(allPostIds.filter(Boolean))].filter((id) => !escolhidos.includes(id))
        : [],
      // Editar aceita lista vazia: é como a cliente desliga o espelhamento
      // daquela origem. A tela avisa antes de salvar.
      podeSalvar: true,
      ficaSemDestino: escolhidos.length === 0,
    }
  }

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
    removidos: [],
    perdeOEnvioParaTodos,
    podeSalvar: escolhidos.length > 0,
    ficaSemDestino: false,
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

/* Lojas que uma origem aceita. `allowedPlatforms` vazio significa TODAS — é
 * como a tela de grupos já lê o campo; tratar vazio como "nenhuma" mostraria
 * uma origem sem loja alguma, que é o oposto do que ela faz. */
export function parseAllowedPlatforms(allowedPlatforms, todas = []) {
  const bruto = String(allowedPlatforms || '').split(',').map((x) => x.trim()).filter(Boolean)
  return bruto.length === 0 ? [...todas] : bruto
}

/**
 * Monta um cartão de espelhamento por ORIGEM: de onde o robô lê, para onde
 * publica, com quantas ofertas saíram hoje.
 *
 * Cartão por origem (e não por destino) porque é a origem que guarda o vínculo
 * no banco e é por ela que o assistente começa — assim "Editar" mexe
 * exatamente no que o cartão mostra.
 *
 * ⚠️ `GET /logs/summary` devolve só as 5 origens com mais movimento. Origem
 * fora dessa lista NÃO tem número medido, e escrever "0 ofertas hoje" ali diria
 * que nada foi publicado quando na verdade não foi medido. Nesses casos
 * `enviadasHoje` é `null` e a tela omite o número.
 */
export function buildMirrorCards({
  origens = [],
  destinos = [],
  links = {},
  topSources = [],
  todasAsLojas = [],
} = {}) {
  const destPorId = new Map(destinos.map((d) => [d.id, d]))
  const medidas = new Map(topSources.filter((s) => s?.jid).map((s) => [s.jid, s]))

  return origens.map((origem) => {
    const vinculo = links?.[origem.id]
    const modo = vinculo?.mode === 'all' ? 'all' : 'explicit'
    const destinosDaOrigem = (vinculo?.postIds ?? [])
      .map((id) => destPorId.get(id))
      .filter(Boolean)
    const medida = medidas.get(origem.waJid)

    return {
      origem,
      destinos: destinosDaOrigem,
      modo,
      lojas: parseAllowedPlatforms(origem.allowedPlatforms, todasAsLojas),
      enviadasHoje: medida ? Number(medida.sent) || 0 : null,
      // Origem sem destino não espelha nada — e isso precisa aparecer no
      // cartão, não ficar escondido num card vazio.
      semDestino: modo === 'explicit' && destinosDaOrigem.length === 0,
    }
  })
}
