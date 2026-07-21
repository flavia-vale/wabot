import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAffiliateApprovedEmail,
  buildAffiliateRejectedEmail,
  buildCommissionEligibleEmail,
  buildCommissionPaidEmail,
  sendAffiliateApprovedEmail,
  sendAffiliateRejectedEmail,
  sendCommissionEligibleEmail,
  sendCommissionPaidEmail,
} from '../src/email/affiliateEmails.js'
import { _resetMailerCache } from '../src/email/mailer.js'

// 009-affiliate-improvements-r1 (US5): notificações por e-mail do afiliado —
// espelha o padrão de test/welcome-email.test.js.

function clearSmtpEnv() {
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    delete process.env[key]
  }
  _resetMailerCache()
}

test('buildAffiliateApprovedEmail gera assunto e corpo esperado', () => {
  const { subject, text, html } = buildAffiliateApprovedEmail({ dashboardUrl: 'https://exemplo.com' })
  assert.match(subject, /aprovada/)
  assert.match(text, /aprovada/)
  assert.match(text, /https:\/\/exemplo\.com\/painel\/afiliados/)
  assert.match(html, /aprovada/)
})

test('buildAffiliateRejectedEmail inclui o motivo quando informado', () => {
  const { subject, text, html } = buildAffiliateRejectedEmail({ adminNotes: 'Dados incompletos', dashboardUrl: 'https://exemplo.com' })
  assert.match(subject, /candidatura/)
  assert.match(text, /Dados incompletos/)
  assert.match(html, /Dados incompletos/)
})

test('buildAffiliateRejectedEmail funciona sem motivo', () => {
  const { text } = buildAffiliateRejectedEmail({ dashboardUrl: 'https://exemplo.com' })
  assert.doesNotMatch(text, /Motivo:/)
})

test('buildCommissionEligibleEmail formata o valor em reais', () => {
  const { subject, text } = buildCommissionEligibleEmail({ amountCents: 6000, dashboardUrl: 'https://exemplo.com' })
  assert.match(subject, /R\$\s?60,00/)
  assert.match(text, /R\$\s?60,00/)
})

test('buildCommissionPaidEmail formata o valor em reais', () => {
  const { subject, text } = buildCommissionPaidEmail({ amountCents: 12345, dashboardUrl: 'https://exemplo.com' })
  assert.match(subject, /R\$\s?123,45/)
  assert.match(text, /R\$\s?123,45/)
})

test('sem SMTP configurado, todos os send* retornam { skipped: true }', async () => {
  clearSmtpEnv()
  assert.deepEqual(await sendAffiliateApprovedEmail({ to: 'afiliado@exemplo.com' }), { skipped: true })
  assert.deepEqual(await sendAffiliateRejectedEmail({ to: 'afiliado@exemplo.com', adminNotes: 'x' }), { skipped: true })
  assert.deepEqual(await sendCommissionEligibleEmail({ to: 'afiliado@exemplo.com', amountCents: 1000 }), { skipped: true })
  assert.deepEqual(await sendCommissionPaidEmail({ to: 'afiliado@exemplo.com', amountCents: 1000 }), { skipped: true })
})

test('endereço de fallback (user_*@sistema.com) é ignorado mesmo com SMTP configurado', async () => {
  process.env.SMTP_HOST = 'smtp.exemplo.com'
  process.env.SMTP_USER = 'user'
  process.env.SMTP_PASS = 'pass'
  _resetMailerCache()
  try {
    const result = await sendAffiliateApprovedEmail({ to: 'user_abc123@sistema.com' })
    assert.deepEqual(result, { skipped: true })
  } finally {
    clearSmtpEnv()
  }
})

test('sem destinatário, send* é seguro e não lança', async () => {
  clearSmtpEnv()
  assert.deepEqual(await sendAffiliateApprovedEmail({}), { skipped: true })
  assert.deepEqual(await sendCommissionPaidEmail({}), { skipped: true })
})
