// Jornada de quem deixou o plano vencer e ainda não renovou.
//
// Até aqui existiam DOIS e-mails depois do vencimento (o aviso no dia e um
// "volta" na semana seguinte) e o assunto morria ali: passados ~9 dias a conta
// nunca mais recebia nada, mesmo com tudo dela ainda guardado no sistema. Quem
// não renovou no primeiro susto simplesmente sumia.
//
// PURO: recebe quantos dias faz que o plano venceu e devolve o e-mail daquele
// momento. Sem banco, sem rede, sem `Date.now()`.
//
// Duas regras de leitura que a tabela precisa respeitar:
//
// 1. As janelas são LARGAS (3 dias), nunca um dia só. A passada de e-mails
//    roda uma vez por dia, ancorada na hora em que a API subiu — um deploy no
//    horário errado, uma passada que falhou ou um dia em que a API ficou fora
//    do ar pulariam a data exata e o e-mail nunca sairia. Com a janela larga o
//    envio atrasa, mas acontece.
//
// 2. As janelas NÃO se encostam. Entre uma e outra a política simplesmente não
//    devolve nada, e é isso que dá o espaçamento — se duas janelas colassem, a
//    cliente receberia dois assuntos diferentes em dias seguidos, que é o jeito
//    mais rápido de virar spam ignorado.
//
// A trava de repetição (o mesmo e-mail não sair duas vezes) NÃO mora aqui: é o
// `dedupDays` de cada e-mail no catálogo, aplicado pelo despachante.

/**
 * A jornada, em ordem. `de`/`ate` são dias inteiros DESDE o vencimento
 * (0 = venceu hoje/ontem).
 */
export const EXPIRED_PLAN_JOURNEY = Object.freeze([
  // Aviso de conta: o robô parou agora. É o único transacional da lista.
  { slug: 'plano_venceu', de: 0, ate: 2 },
  // Primeira semana: o prejuízo ainda é concreto na cabeça dela.
  { slug: 'plano_vencido_primeiros_dias', de: 4, ate: 6 },
  { slug: 'plano_vencido_volta', de: 8, ate: 10 },
  // Depois disso o assunto deixa de ser urgência e passa a ser "o que travou".
  { slug: 'plano_vencido_2_semanas', de: 12, ate: 14 },
  { slug: 'plano_vencido_conta_guardada', de: 16, ate: 18 },
  // Último da jornada: depois daqui a conta não recebe mais e-mail automático
  // de recuperação. Insistir para sempre é o que faz a pessoa marcar como spam
  // — e aí a gente perde também os avisos que ela precisa receber.
  //
  // A jornada inteira cabe em ~3 semanas de propósito: quem não voltou nesse
  // prazo não volta por insistência, e cada e-mail a mais depois daqui custa
  // mais reputação de domínio do que traz cliente.
  { slug: 'plano_vencido_ultimo_aviso', de: 20, ate: 22 },
])

/** Último dia da jornada. Depois dele nenhum e-mail de recuperação sai. */
export const EXPIRED_PLAN_JOURNEY_LAST_DAY = EXPIRED_PLAN_JOURNEY[EXPIRED_PLAN_JOURNEY.length - 1].ate

/**
 * Qual e-mail da jornada cabe hoje.
 *
 * @param {number|null} diasVencido dias inteiros desde o vencimento (0 = hoje)
 * @returns {string|null} slug do e-mail, ou null (fora de janela / ainda no prazo)
 */
export function resolveExpiredPlanEmail(diasVencido) {
  if (!Number.isFinite(diasVencido) || diasVencido < 0) return null
  const passo = EXPIRED_PLAN_JOURNEY.find((etapa) => diasVencido >= etapa.de && diasVencido <= etapa.ate)
  return passo ? passo.slug : null
}
