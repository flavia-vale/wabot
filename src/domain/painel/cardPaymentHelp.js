// Guia "o cartão não passou" da aba Planos (PURO, sem rede nem banco).
//
// A tela de recusa do Mercado Pago é a MESMA para causas com ações opostas, e
// a cliente lê "não aceita nenhum cartão" e desiste. As causas que ela mesma
// consegue resolver, na ordem em que mais acontecem na cobrança automática:
//
//   1. cartão de DÉBITO/pré-pago — a cobrança automática só aceita CRÉDITO;
//   2. conta do Mercado Pago logada com e-mail diferente do cadastro aqui;
//   3. tentar de novo o MESMO cartão várias vezes — o MP passa a recusar por
//      precaução (RCA 2026-09-07, antifraude);
//   4. banco bloqueando compra on-line/recorrente.
//
// E a saída que não depende de cartão nenhum: pagar uma vez, com PIX.
// Linguagem leiga: nada de "preapproval", "antifraude", "gateway", "checkout".

export const CARD_HELP_TITLE = 'O cartão não passou? Confira antes de tentar de novo'

export function buildCardPaymentSteps({ accountEmail } = {}) {
  const email = typeof accountEmail === 'string' && accountEmail.includes('@') ? accountEmail.trim() : null
  return [
    'Use cartão de CRÉDITO. A cobrança automática não aceita cartão de débito nem pré-pago.',
    email
      ? `Entre no Mercado Pago com o mesmo e-mail da sua conta aqui (${email}). Se lá você usa outro e-mail, saia da conta do Mercado Pago ou troque o e-mail aqui antes de assinar.`
      : 'Entre no Mercado Pago com o mesmo e-mail da sua conta aqui. Se lá você usa outro e-mail, saia da conta do Mercado Pago antes de assinar.',
    'Não repita o mesmo cartão várias vezes seguidas: depois de duas recusas o Mercado Pago passa a recusar por segurança. Espere algumas horas ou use outro caminho.',
    'Confira no app do seu banco se compras on-line e cobranças mensais estão liberadas no cartão.',
  ]
}

export const CARD_HELP_PIX_TITLE = 'Quer resolver agora?'
export const CARD_HELP_PIX_TEXT = 'Toque em "Pagar uma vez" no seu plano e escolha PIX: é liberado na hora e não depende de cartão. Depois você liga a cobrança automática com calma.'
export const CARD_HELP_PIX_BUTTON = 'Pagar com PIX agora'
