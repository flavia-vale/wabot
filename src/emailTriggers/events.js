// Gatilhos de e-mail presos a um ACONTECIMENTO (cadastro, pagamento, comissão),
// em oposição aos de ciclo de vida, que são decididos por uma passada diária.
//
// Todos são "dispare e esqueça": nunca lançam para o chamador e nunca seguram a
// resposta da rota. Cadastro e pagamento não podem falhar por causa de e-mail.
//
// Todos passam pelo despachante — logo herdam as travas (e-mail fabricado,
// conta banida, descadastro, repetição, teto diário) sem repetir código.

import dbDefault from '../db.js'
import { sendMail as defaultSendMail } from '../email/mailer.js'
import { sendTemplateEmail } from '../email/dispatcher.js'
import { resolveDashboardUrl } from '../email/layout.js'
import { formatDateBR, formatMoneyBR } from './lifecyclePolicy.js'

function panelLinks(dashboardUrl = resolveDashboardUrl()) {
  return {
    link_afiliados: `${dashboardUrl}/painel/afiliados`,
    link_historico: `${dashboardUrl}/painel/logs`,
    link_whatsapp: `${dashboardUrl}/painel/whatsapp`,
    link_grupos: `${dashboardUrl}/painel/grupos`,
    link_credenciais: `${dashboardUrl}/painel/ids-afiliada`,
  }
}

async function resolveUser({ db, user, userId }) {
  if (user?.email) return user
  if (!userId) return null
  return db.user.findUnique({ where: { id: userId } }).catch(() => null)
}

/**
 * Núcleo comum: resolve o cliente, manda e engole qualquer erro.
 */
async function fire({ db = dbDefault, sendMail = defaultSendMail, slug, user, userId, vars = {}, logger } = {}) {
  try {
    const target = await resolveUser({ db, user, userId })
    if (!target) return { sent: false, skipped: true, reason: 'user_not_found' }
    return await sendTemplateEmail({
      db,
      sendMail,
      slug,
      user: target,
      vars: { ...panelLinks(), ...vars },
      mode: 'auto',
      logger,
    })
  } catch (err) {
    logger?.warn?.({ slug, err: err?.message }, 'e-mail: gatilho falhou')
    return { sent: false, reason: 'error' }
  }
}

// -------------------------------------------------------------------- conta

export function notifyWelcome({ db, sendMail, user, trialEndsAt, logger } = {}) {
  return fire({
    db, sendMail, slug: 'boas_vindas', user, logger,
    vars: { fim_do_teste: formatDateBR(trialEndsAt) },
  })
}

export function notifyPasswordReset({ db, sendMail, user, resetUrl, validity = '1 hora', logger } = {}) {
  return fire({
    db, sendMail, slug: 'recuperar_senha', user, logger,
    vars: { link_nova_senha: resetUrl, validade_link: validity },
  })
}

// ------------------------------------------------------------------- plano

export function notifyPaymentApproved({ db, sendMail, userId, user, plan, amount, accessExpiresAt, logger } = {}) {
  return fire({
    db, sendMail, slug: 'pagamento_aprovado', user, userId, logger,
    vars: {
      plano: planLabel(plan),
      valor: typeof amount === 'number' ? formatMoneyBR(Math.round(amount * 100)) : String(amount ?? ''),
      vale_ate: formatDateBR(accessExpiresAt),
    },
  })
}

function planLabel(plan) {
  const normalized = String(plan ?? '').toLowerCase()
  if (normalized === 'pro') return 'Pro'
  if (normalized === 'basic') return 'Básico'
  return normalized || 'contratado'
}

// -------------------------------------------------------------- saúde do robô

export function notifyFirstSendSuccess({ db, sendMail, userId, logger } = {}) {
  return fire({ db, sendMail, slug: 'primeira_oferta_enviada', userId, logger })
}

// ---------------------------------------------------------------- afiliados

export function notifyAffiliateApproved({ db, sendMail, user, userId, logger } = {}) {
  return fire({ db, sendMail, slug: 'afiliado_aprovado', user, userId, logger })
}

export function notifyAffiliateRejected({ db, sendMail, user, userId, adminNotes, logger } = {}) {
  return fire({
    db, sendMail, slug: 'afiliado_recusado', user, userId, logger,
    vars: { motivo: String(adminNotes ?? '').trim() || 'não informado' },
  })
}

export function notifyReferralSignup({ db, sendMail, referrerUserId, logger } = {}) {
  return fire({ db, sendMail, slug: 'indicado_se_cadastrou', userId: referrerUserId, logger })
}

export function notifyReferralPayment({ db, sendMail, affiliateUserId, commissionCents, holdDays = 30, logger } = {}) {
  return fire({
    db, sendMail, slug: 'indicado_pagou', userId: affiliateUserId, logger,
    vars: { valor: formatMoneyBR(commissionCents), dias_carencia: String(holdDays) },
  })
}

export function notifyCommissionEligible({ db, sendMail, affiliateUserId, user, amountCents, logger } = {}) {
  return fire({
    db, sendMail, slug: 'comissao_liberada', user, userId: affiliateUserId, logger,
    vars: { valor: formatMoneyBR(amountCents) },
  })
}

export function notifyPayoutPaid({ db, sendMail, affiliateUserId, user, amountCents, logger } = {}) {
  return fire({
    db, sendMail, slug: 'saque_pago', user, userId: affiliateUserId, logger,
    vars: { valor: formatMoneyBR(amountCents) },
  })
}
