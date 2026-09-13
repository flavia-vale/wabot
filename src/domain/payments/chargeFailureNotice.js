/**
 * Quem avisar quando uma cobrança de assinatura é RECUSADA — regras puras.
 *
 * O plano B de cobrar é este: se o Mercado Pago não conseguiu cobrar sozinho,
 * a cliente precisa saber ENQUANTO o acesso dela ainda vale, para atualizar o
 * cartão ou pagar avulso antes do robô parar. Sem isso o desfecho é sempre o
 * mesmo — ela descobre pelo robô parado, no pior dia possível.
 *
 * Duas coisas que este módulo NÃO faz, de propósito:
 *  - não corta acesso (o período já pago vale até o fim);
 *  - não manda ela "assinar de novo": tentativa idêntica repetida é o padrão
 *    que dispara a recusa por suspeita do próprio Mercado Pago.
 */

import { classifyChargeOutcome, describeChargeStatusDetail, CHARGE_ACTION_OWNERS } from './chargeOutcome.js'

/** Uma cobrança recusada só rende UM aviso por janela. */
export const CHARGE_FAILURE_NOTICE_COOLDOWN_HOURS = 48

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * @returns {{ notify: boolean, reason: string }}
 */
export function decideChargeFailureNotice({
  charge,
  lastNoticeAt = null,
  laterApprovedChargeAt = null,
  now = new Date(),
  cooldownHours = CHARGE_FAILURE_NOTICE_COOLDOWN_HOURS,
} = {}) {
  if (!charge) return { notify: false, reason: 'sem_cobranca' }
  if (classifyChargeOutcome(charge.status) !== 'recusada') return { notify: false, reason: 'nao_foi_recusa' }

  const nowDate = toDate(now) ?? new Date()
  const attemptedAt = toDate(charge.attemptedAt)
  if (!attemptedAt) return { notify: false, reason: 'sem_data' }

  // Recusa velha não vira aviso: a passada horária lê o histórico inteiro do
  // Mercado Pago, e sem isto o primeiro deploy dispararia e-mail de cobranças
  // de meses atrás — algumas já resolvidas.
  const idadeHoras = (nowDate.getTime() - attemptedAt.getTime()) / 3600000
  if (idadeHoras > 72) return { notify: false, reason: 'recusa_antiga' }

  // Já cobrou depois: o problema se resolveu sozinho e avisar assustaria à toa.
  const approvedAfter = toDate(laterApprovedChargeAt)
  if (approvedAfter && approvedAfter >= attemptedAt) return { notify: false, reason: 'ja_cobrou_depois' }

  const ultimo = toDate(lastNoticeAt)
  if (ultimo && (nowDate.getTime() - ultimo.getTime()) / 3600000 < Math.max(0, Number(cooldownHours) || 0)) {
    return { notify: false, reason: 'avisada_recentemente' }
  }

  return { notify: true, reason: 'cobranca_recusada' }
}

/**
 * O que dizer para a cliente, em linguagem de gente. O texto MUDA conforme de
 * quem é a ação — mandar "atualize seu cartão" quando o problema foi do nosso
 * lado faz ela mexer no que está certo e desconfiar do produto.
 */
export function describeChargeFailureForCustomer(statusDetail) {
  const { owner, label, code } = describeChargeStatusDetail(statusDetail)

  if (owner === CHARGE_ACTION_OWNERS.NOSSA) {
    return {
      code,
      motivo: 'A cobrança não passou por um bloqueio de segurança do meio de pagamento — não foi problema com o seu cartão.',
      oQueFazer: 'Não precisa fazer nada agora: vamos tentar de novo. Se preferir garantir na hora, dá para pagar avulso pelo painel.',
      pedirCartaoNovo: false,
    }
  }

  if (owner === CHARGE_ACTION_OWNERS.MERCADO_PAGO) {
    return {
      code,
      motivo: 'O meio de pagamento bloqueou a cobrança por uma restrição na conta dele.',
      oQueFazer: 'Vale falar com o Mercado Pago. Enquanto isso, o pagamento avulso pelo painel continua funcionando.',
      pedirCartaoNovo: false,
    }
  }

  if (owner === CHARGE_ACTION_OWNERS.ESPERAR) {
    return {
      code,
      motivo: 'A cobrança ainda está em análise no meio de pagamento.',
      oQueFazer: 'Não precisa fazer nada — se ela não passar, a gente te avisa de novo.',
      pedirCartaoNovo: false,
    }
  }

  return {
    code,
    // Sem código conhecido, a frase honesta é "o banco recusou" — inventar um
    // motivo específico faria ela procurar um problema que pode não existir.
    motivo: code ? label : 'O banco recusou a cobrança e não informou o motivo.',
    oQueFazer: 'Atualize o cartão da cobrança automática ou use outro. Se preferir, dá para pagar avulso pelo painel agora mesmo.',
    pedirCartaoNovo: true,
  }
}
