// Jornada de quem fez o teste grátis, não assinou e o acesso venceu.
//
// Até 2026-09-19 existia UM e-mail só (`teste_acabou`, nos dois primeiros dias)
// e depois disso a conta nunca mais recebia nada — com tudo dela ainda guardado
// no sistema. Era o buraco declarado no AGENTS.md ("teste grátis continua sem
// jornada depois"): quem não assinou no susto do primeiro dia simplesmente
// sumia, e ninguém nunca perguntou o que faltou.
//
// PURO: recebe quantos dias faz que o acesso venceu e devolve o e-mail daquele
// momento. Sem banco, sem rede, sem `Date.now()`.
//
// Mesmas duas regras de leitura da jornada de plano pago
// (`expiredPlanJourney.js`): janela nunca de um dia só, porque a passada roda
// 1x/dia e um dia de API fora do ar pularia a data exata; e janelas que não se
// sobrepõem, para nenhum dia devolver dois e-mails. Aqui o bloco inteiro é a
// cadência de dois em dias pedida pela dona do produto (dias 1, 3, 5 e 7), por
// isso as janelas se ENCOSTAM de propósito — ver o comentário de lá.
//
// A trava de repetição (o mesmo e-mail não sair duas vezes) NÃO mora aqui: é o
// `dedupDays` de cada e-mail no catálogo, aplicado pelo despachante.

/**
 * A jornada, em ordem. `de`/`ate` são dias inteiros DESDE o fim do teste
 * (0 = acabou hoje/ontem).
 */
export const EXPIRED_TRIAL_JOURNEY = Object.freeze([
  // Aviso de conta: o robô parou agora. É o único transacional da lista.
  { slug: 'teste_acabou', de: 0, ate: 2 },
  { slug: 'teste_acabou_lembrete', de: 3, ate: 4 },
  // Os dois últimos levam o voucher de desconto para assinar. O segundo repete
  // o MESMO código e diz quanto prazo sobrou — número calculado, nunca escrito
  // no texto (com janela de dois dias, "faltam 3 dias" vira mentira no dia
  // seguinte).
  { slug: 'teste_voucher', de: 5, ate: 6, voucher: true },
  { slug: 'teste_voucher_ultimos_dias', de: 7, ate: 8, voucher: true },
])

/**
 * Último dia da jornada. Depois dele nenhum e-mail automático de recuperação
 * sai: quem não assinou em uma semana e meia não assina por insistência, e cada
 * e-mail a mais custa mais reputação de domínio do que traz cliente. É também
 * o motivo de o último e-mail DIZER que é o último.
 */
export const EXPIRED_TRIAL_JOURNEY_LAST_DAY = EXPIRED_TRIAL_JOURNEY[EXPIRED_TRIAL_JOURNEY.length - 1].ate

/**
 * Qual e-mail da jornada cabe hoje.
 *
 * @param {number|null} diasVencido dias inteiros desde o fim do teste
 * @returns {string|null}
 */
export function resolveExpiredTrialEmail(diasVencido) {
  return resolveExpiredTrialStep(diasVencido)?.slug ?? null
}

/**
 * A etapa inteira (com a marca de voucher). Mesma regra de janela.
 *
 * @param {number|null} diasVencido
 * @returns {{ slug: string, de: number, ate: number, voucher?: boolean }|null}
 */
export function resolveExpiredTrialStep(diasVencido) {
  if (!Number.isFinite(diasVencido) || diasVencido < 0) return null
  return EXPIRED_TRIAL_JOURNEY.find((etapa) => diasVencido >= etapa.de && diasVencido <= etapa.ate) ?? null
}
