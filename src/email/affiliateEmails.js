// 009-affiliate-improvements-r1 (US5): notificações por e-mail para o
// afiliado — candidatura aprovada, candidatura rejeitada, comissão elegível
// e comissão paga. Espelha src/email/welcomeEmail.js: builders puros +
// send* best-effort (nunca lança para o chamador, fire-and-forget) usando o
// mesmo transporte no-op-sem-SMTP de src/email/mailer.js (FR-022/023).

import { sendMail } from './mailer.js'

const BRAND_NAME = 'BOTinho'
const DEFAULT_DASHBOARD_URL = 'https://espelhagrupos.com.br'

// Fallback de cadastro (auth.js: `user_${randomToken(6)}@sistema.com`) nunca
// deve receber e-mail — não é um endereço real informado pela pessoa (FR-024).
const FALLBACK_EMAIL_RE = /^user_.*@sistema\.com$/i

function resolveDashboardUrl() {
  const raw = (process.env.DASHBOARD_URL || process.env.API_URL || DEFAULT_DASHBOARD_URL).trim()
  return raw.replace(/\/+$/, '')
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100)
}

function isFallbackEmail(to) {
  return FALLBACK_EMAIL_RE.test(String(to ?? '').trim())
}

export function buildAffiliateApprovedEmail({ dashboardUrl = resolveDashboardUrl() } = {}) {
  const link = `${dashboardUrl}/painel/afiliados`
  const subject = `Sua candidatura ao programa de afiliados ${BRAND_NAME} foi aprovada!`
  const text = [
    'Boas notícias!',
    '',
    `Sua candidatura ao programa de afiliados do ${BRAND_NAME} foi aprovada.`,
    'Seu link de indicação já está ativo — acesse o painel para pegar seu código e acompanhar suas comissões.',
    '',
    `Acesse: ${link}`,
  ].join('\n')
  const html = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">Boas notícias! 🎉</h1>
    <p style="font-size:15px;line-height:1.6">Sua candidatura ao programa de afiliados do <strong>${BRAND_NAME}</strong> foi aprovada.</p>
    <p style="font-size:15px;line-height:1.6">Seu link de indicação já está ativo — acesse o painel para pegar seu código e acompanhar suas comissões.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar painel de afiliado</a>
    </p>
  </div>
</body>
</html>`
  return { subject, text, html }
}

export function buildAffiliateRejectedEmail({ adminNotes = null, dashboardUrl = resolveDashboardUrl() } = {}) {
  const link = `${dashboardUrl}/painel/afiliados`
  const subject = `Atualização sobre sua candidatura ao programa de afiliados ${BRAND_NAME}`
  const reasonText = adminNotes ? `\nMotivo: ${adminNotes}\n` : ''
  const text = [
    'Olá,',
    '',
    `Sua candidatura ao programa de afiliados do ${BRAND_NAME} não foi aprovada desta vez.`,
    reasonText,
    `Você pode enviar uma nova candidatura pelo painel: ${link}`,
  ].filter(Boolean).join('\n')
  const reasonHtml = adminNotes ? `<p style="font-size:14px;line-height:1.6;color:#4b5563">Motivo: ${adminNotes}</p>` : ''
  const html = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">Olá,</h1>
    <p style="font-size:15px;line-height:1.6">Sua candidatura ao programa de afiliados do <strong>${BRAND_NAME}</strong> não foi aprovada desta vez.</p>
    ${reasonHtml}
    <p style="font-size:15px;line-height:1.6">Você pode enviar uma nova candidatura pelo painel.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Acessar painel</a>
    </p>
  </div>
</body>
</html>`
  return { subject, text, html }
}

export function buildCommissionEligibleEmail({ amountCents = 0, dashboardUrl = resolveDashboardUrl() } = {}) {
  const link = `${dashboardUrl}/painel/afiliados`
  const amount = formatCurrency(amountCents)
  const subject = `Você tem ${amount} de comissão liberada no ${BRAND_NAME}`
  const text = [
    'Boas notícias!',
    '',
    `Uma comissão de ${amount} foi liberada na sua conta de afiliado do ${BRAND_NAME} (passou a janela de segurança de reembolso).`,
    'Esse valor já entra no seu saldo disponível para saque.',
    '',
    `Acesse: ${link}`,
  ].join('\n')
  const html = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">Boas notícias! 💰</h1>
    <p style="font-size:15px;line-height:1.6">Uma comissão de <strong>${amount}</strong> foi liberada na sua conta de afiliado do <strong>${BRAND_NAME}</strong> (passou a janela de segurança de reembolso).</p>
    <p style="font-size:15px;line-height:1.6">Esse valor já entra no seu saldo disponível para saque.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Ver meu saldo</a>
    </p>
  </div>
</body>
</html>`
  return { subject, text, html }
}

export function buildCommissionPaidEmail({ amountCents = 0, dashboardUrl = resolveDashboardUrl() } = {}) {
  const link = `${dashboardUrl}/painel/afiliados`
  const amount = formatCurrency(amountCents)
  const subject = `Pagamento de ${amount} enviado — programa de afiliados ${BRAND_NAME}`
  const text = [
    'Pagamento realizado!',
    '',
    `Enviamos ${amount} de comissão para a sua chave PIX cadastrada no ${BRAND_NAME}.`,
    '',
    `Acesse: ${link}`,
  ].join('\n')
  const html = `<!doctype html>
<html lang="pt-br">
<body style="margin:0;background:#EEF6F2;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;margin:0 0 8px">Pagamento realizado! ✅</h1>
    <p style="font-size:15px;line-height:1.6">Enviamos <strong>${amount}</strong> de comissão para a sua chave PIX cadastrada no <strong>${BRAND_NAME}</strong>.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">Ver histórico</a>
    </p>
  </div>
</body>
</html>`
  return { subject, text, html }
}

// send* — best-effort, nunca lança para o chamador (FR-023). Skip silencioso
// para endereço ausente ou de fallback (FR-024).
async function safeSend(to, builder) {
  if (!to || isFallbackEmail(to)) return { skipped: true }
  try {
    const { subject, text, html } = builder()
    return await sendMail({ to, subject, text, html })
  } catch (err) {
    return { skipped: true, error: String(err?.message ?? err) }
  }
}

export async function sendAffiliateApprovedEmail({ to } = {}) {
  return safeSend(to, () => buildAffiliateApprovedEmail())
}

export async function sendAffiliateRejectedEmail({ to, adminNotes } = {}) {
  return safeSend(to, () => buildAffiliateRejectedEmail({ adminNotes }))
}

export async function sendCommissionEligibleEmail({ to, amountCents } = {}) {
  return safeSend(to, () => buildCommissionEligibleEmail({ amountCents }))
}

export async function sendCommissionPaidEmail({ to, amountCents } = {}) {
  return safeSend(to, () => buildCommissionPaidEmail({ amountCents }))
}
