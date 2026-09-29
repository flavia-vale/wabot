// Peças do "topo citável" das páginas prioritárias (item 7 do
// PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md, seção 6, item 4): resposta
// afirmativa nas 3 primeiras linhas (o que é, para quem, quanto custa), 1-2
// números próprios COM fonte, cabeçalho em pergunta.
//
// Por quê: 44% das citações de IA saem dos primeiros 30% da página, e
// estatística com fonte soma +28-43% de chance de citação (paper GEO, KDD
// 2024 — fontes na seção 9 do plano).
//
// Regras que este arquivo obedece:
// - Preço NUNCA escrito à mão: sai de DEFAULT_LANDING_PLANS (a mesma fonte da
//   ficha técnica, do llms.txt e de /precos; guardas em
//   test/ficha-tecnica-canonica.test.js e test/llms-txt-sync.test.js).
// - Número próprio só entra MEDIDO, com data e origem. Os de hoje foram
//   medidos no banco de produção em 27/09/2026 (`scripts/diag-ltv-retencao.mjs`,
//   registrados em docs/marketing/SERIE_HISTORICA_SEO.md, seção 4b). Para
//   atualizar: medir de novo e trocar a data JUNTO. Nunca estimar.
// - Nenhuma citação entre aspas: não há depoimento real com nome e autorização
//   no repositório (pendência em RESUMO_E_PLANO_2026-09-23.md). Sem fonte
//   verificável, não entra.
//
// Módulo puro (sem JSX) para os testes em node:test importarem direto.

import { DEFAULT_LANDING_PLANS } from './marketing-content.js'
import { formatDatePtBr } from './editorial-content.js'

const planosPagos = DEFAULT_LANDING_PLANS.filter((plan) => Number(plan.priceValue) > 0)

/** "Basic R$39 ou Pro R$69 a cada 30 dias" — montado dos planos reais. */
export const PRECO_PLANOS_FRASE = (() => {
  const partes = planosPagos.map((plan) => `${plan.name} ${plan.price}`)
  const lista = partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} ou ${partes.at(-1)}`
  return planosPagos[0]?.period ? `${lista} a cada ${planosPagos[0].period}` : lista
})()

/** Mesma frase do fato "Teste grátis" da ficha técnica (lib/ficha-tecnica.js). */
export const TESTE_GRATIS_FRASE = '7 dias grátis com o Pro completo, sem cartão'

/** "Basic R$39 ou Pro R$69 a cada 30 dias; antes, 7 dias grátis com o Pro completo, sem cartão." */
export const CUSTO_FRASE = `${PRECO_PLANOS_FRASE}; antes, ${TESTE_GRATIS_FRASE}.`

/** "R$69 a cada 30 dias" — preço de um plano pelo id, para recurso só do Pro. */
export function precoDoPlano(id) {
  const plan = DEFAULT_LANDING_PLANS.find((p) => p.id === id)
  return plan ? `${plan.price} a cada ${plan.period}` : ''
}

// Medidos no banco de produção em 27/09/2026 (SERIE_HISTORICA_SEO.md, 4b).
export const NUMEROS_MEDIDOS_EM = '2026-09-27'
export const NUMEROS_PROPRIOS = {
  clientesPagantes: 38,
  contasComOfertasAutomaticas: 43,
  // Coorte do 1º pagamento em agosto: 8 clientes, 7 já chegaram à data de
  // renovar e as 7 renovaram. "7 de 7", nunca "100% de renovação" solto.
  renovacaoAgosto: '7 de 7',
}

export const NUMEROS_FONTE = `contagem no banco de dados do Espelha Grupos em ${formatDatePtBr(NUMEROS_MEDIDOS_EM)}`

/**
 * Os dois números próprios do topo, com a fonte na mesma frase — é a forma que
 * a IA consegue citar sem perder a origem.
 */
export function fraseNumerosProprios() {
  return `Números nossos (fonte: ${NUMEROS_FONTE}): ${NUMEROS_PROPRIOS.clientesPagantes} clientes pagantes, e das clientes que pagaram pela primeira vez em agosto e já chegaram à data de renovar, ${NUMEROS_PROPRIOS.renovacaoAgosto} renovaram.`
}
