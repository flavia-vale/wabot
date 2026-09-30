// Dados da compradora e do item que o checkout avulso (Checkout Pro) manda ao
// Mercado Pago. Módulo PURO/testável: NÃO importa db/axios.
//
// RCA 2026-09-30 (ver docs/rca/cobranca.md): em 30 dias houve 17 recusas por
// suspeita (`cc_rejected_high_risk` / `rejected_high_risk`), TODAS em
// `regular_payment` (o avulso) — nenhuma na cobrança recorrente do mês. Houve
// recusa até em Pix e saldo do Mercado Pago, onde não existe banco nem cartão:
// a nota de risco é dada à COMPRADORA. E a preferência não mandava nada sobre
// ela — só título, quantidade e preço. A doc de aprovação do MP pede
// `payer` (e-mail, telefone) e `items` com `id`, `description` e
// `category_id`: sem isso o motor de risco julga uma compra anônima.
//
// NOME NÃO VAI (decisão da dona do produto, 2026-09-30): o cadastro guarda
// nome de LOJA ("Achadinhos da Flavia") tanto quanto de pessoa, e não há
// regra segura para separar. Nome que não bate com o titular do cartão piora
// a nota; o próprio checkout do MP já pede o nome do titular.
//
// Regra: só manda o que é REAL. Dado inventado ou de preenchimento automático
// (e-mail `@sistema.com`, telefone fora do padrão) piora a leitura em vez de
// melhorar — nesses casos o campo simplesmente não vai.

import { classifyPayerEmail } from './payerEmail.js'

// Categoria do MP para serviço/assinatura de software.
export const CHECKOUT_ITEM_CATEGORY = 'services'

/**
 * Telefone brasileiro em `{ area_code, number }`. Aceita com ou sem o 55 na
 * frente e com qualquer pontuação. Fora do padrão (DDD + 8 ou 9 dígitos) → null.
 */
export function parseBrazilianPhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits.startsWith('0')) return null
  return { area_code: digits.slice(0, 2), number: digits.slice(2) }
}

/**
 * `payer` da preferência, só com o que é real (e-mail e telefone). Sem nada
 * confiável → null. O nome é ignorado de propósito, mesmo se vier.
 */
export function buildCheckoutPayer({ email, contactPhone } = {}) {
  const payer = {}
  if (email && !classifyPayerEmail(email)) payer.email = String(email).trim()
  const phone = parseBrazilianPhone(contactPhone)
  if (phone) payer.phone = phone
  return Object.keys(payer).length ? payer : null
}

/** Item da preferência com identificação, descrição e categoria. */
export function buildCheckoutItem({ plan, title, price }) {
  return {
    id: `plano-${plan}`,
    title,
    description: `${title} — Espelha Grupos`,
    category_id: CHECKOUT_ITEM_CATEGORY,
    quantity: 1,
    unit_price: price,
    currency_id: 'BRL',
  }
}
