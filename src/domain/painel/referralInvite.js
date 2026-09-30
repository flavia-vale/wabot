// Link de indicação nos dois momentos de maior satisfação da cliente.
//
// Medido em produção (2026-09-27): o programa de indicação existe desde o
// começo (`User.referralCode`, `?ref=`; programa de afiliados com `?aff=` e
// comissão) e NUNCA foi usado — zero cadastros com `referredBy` na história.
// Motivo mais provável: a cliente só descobre o link se abrir a aba Afiliados
// sozinha. Ninguém pede indicação a quem ainda não viu o produto funcionar.
//
// Aqui mora a regra pura (sem React, sem rede) que decide QUANDO mostrar e o
// QUE dizer. Os dois cards do painel (1ª oferta publicada e pagamento
// confirmado) só renderizam o que sai daqui. A tela /painel/afiliados usa a
// mesma função de link para nunca haver dois formatos.
//
// Honestidade sobre os dois links:
//  - `?aff=<código>` é o do PROGRAMA DE AFILIADOS: só existe para perfil
//    aprovado e é o único que paga comissão (`tryCreateAffiliateCommission`).
//  - `?ref=<referralCode>` é o da conta: todo mundo tem, o cadastro registra
//    `referredBy` e o admin mostra "Indicação de cliente" — mas não paga nada.
// Por isso o texto de comissão só é afirmado para quem já é afiliada aprovada;
// para as demais, o card mostra o link da conta e convida a entrar no programa.

export const SIGNUP_BASE_URL = 'https://espelhagrupos.com.br/cadastro'
export const AFFILIATE_PAGE_HREF = '/painel/afiliados'

// Mesmos defaults de `DEFAULT_SETTINGS` em src/domain/affiliate/service.js e
// da tela /painel/afiliados. Só entram se `GET /affiliate/config` falhar.
export const DEFAULT_AFFILIATE_CONFIG = Object.freeze({
  commissionPercent: 30,
  commissionRecurringPercent: 30,
  recurringCommissionEnabled: true,
  commissionHoldDays: 30,
})

export function buildAffiliateLink(code) {
  const c = typeof code === 'string' ? code.trim() : ''
  return c ? `${SIGNUP_BASE_URL}?aff=${encodeURIComponent(c)}` : null
}

export function buildReferralLink(referralCode) {
  const c = typeof referralCode === 'string' ? referralCode.trim() : ''
  return c ? `${SIGNUP_BASE_URL}?ref=${encodeURIComponent(c)}` : null
}

function pct(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// O que o programa paga, na frase que a tela /painel/afiliados já usa.
export function describeCommission(config = DEFAULT_AFFILIATE_CONFIG) {
  const cfg = { ...DEFAULT_AFFILIATE_CONFIG, ...(config ?? {}) }
  const first = pct(cfg.commissionPercent, DEFAULT_AFFILIATE_CONFIG.commissionPercent)
  const recurring = pct(cfg.commissionRecurringPercent, DEFAULT_AFFILIATE_CONFIG.commissionRecurringPercent)
  const holdDays = pct(cfg.commissionHoldDays, DEFAULT_AFFILIATE_CONFIG.commissionHoldDays)
  const recurringOn = cfg.recurringCommissionEnabled !== false && recurring > 0
  let text = `${first}% da primeira compra de cada pessoa que entrar pelo seu link`
  if (recurringOn) text += `, e ${recurring}% em cada renovação seguinte`
  text += `. O valor fica disponível ${holdDays} dias depois do pagamento, por segurança contra reembolso.`
  return { first, recurring, recurringOn, holdDays, text }
}

/**
 * Decide o card: qual link mostrar e o que prometer.
 *
 * @param {object} args
 * @param {{status?: string, code?: string}|null} args.affiliateProfile  de GET /affiliate/me
 * @param {string|null} args.referralCode                                de GET /auth/me
 * @param {object} args.config                                            de GET /affiliate/config
 * @returns {null | { mode: 'affiliate'|'referral', link: string, commission: object, promise: string, cta: {href: string, label: string}|null }}
 */
export function buildReferralInvite({ affiliateProfile = null, referralCode = null, config } = {}) {
  const commission = describeCommission(config)
  const approved = affiliateProfile?.status === 'approved'
  const affLink = approved ? buildAffiliateLink(affiliateProfile.code) : null
  if (affLink) {
    return {
      mode: 'affiliate',
      link: affLink,
      commission,
      promise: `Você ganha ${commission.text}`,
      cta: { href: AFFILIATE_PAGE_HREF, label: 'Ver minhas indicações' },
    }
  }
  const refLink = buildReferralLink(referralCode)
  if (!refLink) return null
  return {
    mode: 'referral',
    link: refLink,
    commission,
    promise: `Quer ganhar ${commission.first}% da primeira compra de quem você indicar? Entre no programa de afiliadas.`,
    cta: { href: AFFILIATE_PAGE_HREF, label: 'Entrar no programa' },
  }
}

// Card da 1ª oferta publicada: aparece na tela inicial quando o robô já
// publicou pelo menos uma oferta (`hasSuccessfulLog` de GET /dashboard/status)
// e some depois que ela fecha. `null` em hasSuccessfulLog = ainda carregando.
export function shouldShowFirstOfferInvite({ hasSuccessfulLog, dismissed } = {}) {
  if (dismissed) return false
  return hasSuccessfulLog === true
}

export const FIRST_OFFER_INVITE_COPY = Object.freeze({
  title: 'Deu certo. Conhece outra afiliada?',
  body: 'Sua primeira oferta já saiu. Passe seu link de indicação para quem também divulga ofertas.',
})

export const PAYMENT_INVITE_COPY = Object.freeze({
  title: 'Conhece outra afiliada?',
  body: 'Passe seu link de indicação para quem também divulga ofertas.',
})

export const REFERRAL_INVITE_COPY = Object.freeze({
  linkLabel: 'Seu link de indicação',
  copy: 'Copiar',
  copied: 'Copiado!',
  dismiss: 'Fechar',
})
