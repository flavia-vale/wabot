// A prova do que o robô já fez — em trabalho poupado, não em volume.
//
// Itens D1/D2 do plano de ativação de 2026-09-08. 32 das 114 pessoas que não
// pagaram VIRAM oferta sair e mesmo assim nunca abriram o pagamento. Não é
// configuração: o produto funcionou para elas. O que faltou foi alguém mostrar
// o que elas ganharam — e o aviso com a prova (`buildTrialEndingNotice`) mora
// DENTRO do painel, que é justamente onde essa cliente não entra, porque está
// tudo funcionando sozinho.
//
// Por que trabalho poupado e não número de ofertas: "47 ofertas" é métrica
// nossa, e ela não tem com o que comparar. "141 mensagens que você não digitou"
// é a mesma informação medida na moeda dela — o tempo que ela teria gasto
// copiando e colando, que é exatamente o serviço que o robô presta.
//
// Módulo PURO: sem banco, sem rede.

/**
 * Dias que faltam para o fim do teste quando a prova é enviada.
 *
 * 4 = terceiro dia de um teste de 7. Escolhido porque os últimos três dias já
 * têm os avisos de contagem regressiva (`teste_acaba_em_3/2/1_dias`) e a regra
 * da casa é no máximo UM e-mail de ciclo de vida por passada: encaixar aqui é o
 * único ponto do teste em que a prova não disputa espaço com outro aviso.
 */
export const TRIAL_PROOF_DAYS_LEFT = 4

/** Mínimo de ofertas publicadas para haver prova. */
export const TRIAL_PROOF_MIN_OFFERS = 1

/**
 * @param {{ offersPublished?: number, destGroupCount?: number }} args
 * @returns {null | { ofertas_publicadas: string, mensagens_poupadas: string, grupos: string }}
 */
export function buildTrialProofVars({ offersPublished = 0, destGroupCount = 0 } = {}) {
  const ofertas = Math.max(0, Math.trunc(Number(offersPublished) || 0))
  if (ofertas < TRIAL_PROOF_MIN_OFFERS) return null

  // Um grupo é o piso: mesmo sem saber os destinos, cada oferta publicada é uma
  // mensagem que ela não digitou. Nunca inflar o número — a conta precisa
  // sobreviver à cliente conferindo no celular.
  const grupos = Math.max(1, Math.trunc(Number(destGroupCount) || 0))

  return {
    ofertas_publicadas: String(ofertas),
    grupos: String(grupos),
    mensagens_poupadas: String(ofertas * grupos),
  }
}

/**
 * A prova é devida agora? Puro, para o teste não precisar do banco.
 * @param {{ plan?: string, daysLeft?: number|null, offersPublished?: number }} args
 */
export function shouldSendTrialProof({ plan, daysLeft, offersPublished = 0 } = {}) {
  if (String(plan ?? '').toLowerCase() !== 'trial') return false
  if (daysLeft !== TRIAL_PROOF_DAYS_LEFT) return false
  // Sem nenhuma oferta publicada NÃO existe prova — e mandar "veja o que o robô
  // fez" para quem não viu nada acontecer é a forma mais rápida de confirmar
  // para ela que o produto não funciona. Esse caso é do e-mail de configuração.
  return Math.trunc(Number(offersPublished) || 0) >= TRIAL_PROOF_MIN_OFFERS
}
