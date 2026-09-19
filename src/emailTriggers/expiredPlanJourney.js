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
// 1. Nenhuma janela é de um dia só. A passada de e-mails roda uma vez por dia,
//    ancorada na hora em que a API subiu — um deploy no horário errado, uma
//    passada que falhou ou um dia em que a API ficou fora do ar pulariam a data
//    exata e o e-mail nunca sairia. Com a janela larga o envio atrasa, mas
//    acontece.
//
// 2. As janelas nunca se SOBREPÕEM: cada dia devolve no máximo um e-mail.
//
//    Até 2026-09-19 elas também não podiam se ENCOSTAR (havia sempre um dia de
//    folga entre uma e a seguinte), porque duas janelas coladas podem mandar
//    dois assuntos em dias seguidos quando a passada atrasa. A dona do produto
//    pediu a cadência dos dias 1, 3, 5 e 7 — de dois em dois dias, o que não
//    cabe em janelas com folga —, então o BLOCO INICIAL (os quatro primeiros)
//    encosta de propósito. O rabo da jornada, que é de recuperação lenta,
//    mantém a folga: ali dois e-mails em dias seguidos continuam sendo só
//    spam.
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
  // Bloco pedido pela dona do produto (2026-09-19): dias 1, 3, 5 e 7. Os
  // quatro primeiros e-mails saem de dois em dois dias, e os dois últimos
  // levam o voucher de desconto para voltar.
  { slug: 'plano_vencido_primeiros_dias', de: 3, ate: 4 },
  { slug: 'plano_vencido_voucher', de: 5, ate: 6, voucher: true },
  // O segundo voucher repete o MESMO código e diz quanto prazo sobrou. O
  // número de dias é calculado, nunca escrito no texto: com a janela de dois
  // dias, "faltam 3 dias" vira mentira no dia seguinte.
  { slug: 'plano_vencido_voucher_ultimos_dias', de: 7, ate: 8, voucher: true },
  // Daqui para baixo o assunto deixa de ser urgência e passa a ser "o que
  // travou" — e as janelas voltam a ter folga entre si.
  { slug: 'plano_vencido_volta', de: 11, ate: 12 },
  { slug: 'plano_vencido_2_semanas', de: 14, ate: 15 },
  { slug: 'plano_vencido_conta_guardada', de: 17, ate: 18 },
  // Último da jornada: depois daqui a conta não recebe mais e-mail automático
  // de recuperação. Insistir para sempre é o que faz a pessoa marcar como spam
  // — e aí a gente perde também os avisos que ela precisa receber.
  //
  // A jornada inteira cabe em ~3 semanas de propósito: quem não voltou nesse
  // prazo não volta por insistência, e cada e-mail a mais depois daqui custa
  // mais reputação de domínio do que traz cliente.
  { slug: 'plano_vencido_ultimo_aviso', de: 21, ate: 22 },
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
  return resolveExpiredPlanStep(diasVencido)?.slug ?? null
}

/**
 * A etapa inteira (com a marca de voucher), para quem precisa saber mais que o
 * slug. Mesma regra de janela do `resolveExpiredPlanEmail`.
 *
 * @param {number|null} diasVencido
 * @returns {{ slug: string, de: number, ate: number, voucher?: boolean }|null}
 */
export function resolveExpiredPlanStep(diasVencido) {
  if (!Number.isFinite(diasVencido) || diasVencido < 0) return null
  return EXPIRED_PLAN_JOURNEY.find((etapa) => diasVencido >= etapa.de && diasVencido <= etapa.ate) ?? null
}
