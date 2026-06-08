import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWelcomeEmail, sendWelcomeEmail } from '../src/email/welcomeEmail.js'
import { isEmailConfigured, sendMail, _resetMailerCache } from '../src/email/mailer.js'

function clearSmtpEnv() {
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    delete process.env[key]
  }
  _resetMailerCache()
}

test('buildWelcomeEmail usa o primeiro nome e inclui os 5 passos', () => {
  const { subject, text, html } = buildWelcomeEmail({
    name: 'Flávia Vale',
    dashboardUrl: 'https://exemplo.com',
    supportEmail: 'contato@exemplo.com',
    supportWhatsappUrl: 'https://wa.me/5500000000000',
  })
  assert.match(subject, /Bem-vinda/)
  assert.match(text, /Olá, Flávia!/)
  assert.match(html, /Olá, Flávia!/)
  // 5 passos numerados no texto
  for (const n of [1, 2, 3, 4, 5]) {
    assert.match(text, new RegExp(`${n}\\. `))
  }
  // link de acesso e contatos de suporte presentes
  assert.match(text, /https:\/\/exemplo\.com\/login/)
  assert.match(text, /contato@exemplo\.com/)
  assert.match(text, /wa\.me\/5500000000000/)
  assert.match(html, /https:\/\/exemplo\.com\/login/)
})

test('buildWelcomeEmail sem nome usa saudação genérica', () => {
  const { text } = buildWelcomeEmail({ name: '', dashboardUrl: 'https://x.com' })
  assert.match(text, /^Olá!/)
})

test('isEmailConfigured é false sem envs SMTP', () => {
  clearSmtpEnv()
  assert.equal(isEmailConfigured(), false)
})

test('sendMail vira no-op sem SMTP configurado', async () => {
  clearSmtpEnv()
  const result = await sendMail({ to: 'alguem@exemplo.com', subject: 'oi', text: 'oi' })
  assert.deepEqual(result, { skipped: true })
})

test('sendWelcomeEmail é seguro sem SMTP e sem destinatário', async () => {
  clearSmtpEnv()
  assert.deepEqual(await sendWelcomeEmail({ to: 'alguem@exemplo.com', name: 'Ana' }), { skipped: true })
  assert.deepEqual(await sendWelcomeEmail({}), { skipped: true })
})
