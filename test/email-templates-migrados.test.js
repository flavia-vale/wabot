// Garantias que antes moravam nos builders separados (welcomeEmail.js,
// nurtureEmails.js, affiliateEmails.js, credentialExpiryEmail.js) e agora valem
// para os MESMOS textos dentro do catálogo único (src/email/registry.js).
//
// Os builders foram removidos de propósito: dois lugares com o mesmo texto
// divergem, e o painel admin só edita o catálogo.

import test from 'node:test'
import assert from 'node:assert/strict'
import { getTemplateDefinition } from '../src/email/registry.js'
import { loadTemplate, renderTemplate, standardVars, sendTemplateEmail } from '../src/email/dispatcher.js'
import { describeExpiredStores, EXPIRY_TEMPLATE_SLUG } from '../src/credentialExpiry/message.js'
import { isEmailConfigured, sendMail, _resetMailerCache } from '../src/email/mailer.js'

const NOW = new Date('2026-08-16T12:00:00Z')
const silentLogger = { info() {}, warn() {}, error() {} }

function clearSmtpEnv() {
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
    delete process.env[key]
  }
  _resetMailerCache()
}

const emptyDb = {
  emailTemplate: { findUnique: async () => null },
  emailOptOut: { findUnique: async () => null },
  analyticsEvent: { count: async () => 0 },
  emailSendLog: { count: async () => 0, create: async ({ data }) => ({ id: 'l1', ...data }), update: async () => ({}) },
}

async function render(slug, { user = { id: 'u1', name: 'Juliane Pumuceno', email: 'j@exemplo.com', status: 'active' }, vars = {} } = {}) {
  const template = await loadTemplate({ db: emptyDb, slug })
  return renderTemplate({ template, vars: { ...standardVars({ user, dashboardUrl: 'https://exemplo.com' }), ...vars }, unsubscribeUrl: 'https://exemplo.com/api/emails/unsubscribe?token=t' })
}

test('boas-vindas: primeiro nome, 5 passos e data do fim do teste', async () => {
  const { subject, text, html } = await render('boas_vindas', { vars: { fim_do_teste: '23/08/2026' } })
  assert.match(subject, /Bem-vinda/)
  assert.match(text, /Olá, Juliane!/)
  assert.match(html, /Olá, Juliane!/)
  for (const n of [1, 2, 3, 4, 5]) assert.match(text, new RegExp(`${n}\\. `))
  assert.match(text, /23\/08\/2026/)
  assert.match(text, /https:\/\/exemplo\.com\/login/)
  assert.match(text, /contato@espelhagrupos\.com\.br|{{email_suporte}}/)
})

test('sem nome, a saudação fica genérica', async () => {
  const { text } = await render('boas_vindas', {
    user: { id: 'u1', name: '', email: 'j@exemplo.com', status: 'active' },
    vars: { fim_do_teste: '23/08/2026' },
  })
  assert.match(text, /Olá!/)
  assert.doesNotMatch(text, /Olá, !/)
})

test('trilha de nutrição: 3 passos, todos de divulgação e com descadastro', async () => {
  for (const slug of ['nutricao_dia_2', 'nutricao_dia_5', 'nutricao_dia_7']) {
    const definition = getTemplateDefinition(slug)
    assert.ok(definition, `catálogo sem ${slug}`)
    assert.equal(definition.category, 'marketing')
    const { text, html } = await render(slug)
    assert.match(text, /unsubscribe\?token=/)
    assert.match(html, /unsubscribe\?token=/)
    assert.match(text, /Olá, Juliane!/)
  }
})

test('afiliados: aprovada, recusada, comissão liberada e saque pago', async () => {
  const aprovada = await render('afiliado_aprovado', { vars: { link_afiliados: 'https://exemplo.com/painel/afiliados' } })
  assert.match(aprovada.subject, /aprovada/i)
  assert.match(aprovada.text, /https:\/\/exemplo\.com\/painel\/afiliados/)

  const recusada = await render('afiliado_recusado', { vars: { motivo: 'dados incompletos', link_afiliados: 'https://exemplo.com/painel/afiliados' } })
  assert.match(recusada.text, /dados incompletos/)

  const liberada = await render('comissao_liberada', { vars: { valor: 'R$ 62,00', link_afiliados: 'https://x.com' } })
  assert.match(liberada.subject, /R\$ 62,00/)

  const paga = await render('saque_pago', { vars: { valor: 'R$ 62,00', link_afiliados: 'https://x.com' } })
  assert.match(paga.text, /R\$ 62,00/)
  assert.match(paga.text, /PIX/)
})

test('código de acesso vencido: uma loja e duas lojas no mesmo texto', async () => {
  const uma = describeExpiredStores(['mercadolivre'])
  assert.equal(uma.lojas, 'Mercado Livre')
  assert.match(uma.consequencia, /cupom/)

  const duas = describeExpiredStores(['mercadolivre', 'amazon'])
  assert.equal(duas.lojas, 'Mercado Livre e Amazon')

  const { subject, text } = await render(EXPIRY_TEMPLATE_SLUG, {
    vars: { ...duas, link_credenciais: 'https://exemplo.com/painel/ids-afiliada' },
  })
  assert.match(subject, /venceu/)
  assert.match(text, /Mercado Livre e Amazon/)
  assert.match(text, /continuam saindo/i)
  assert.match(text, /comissão CONTINUA sendo sua/i)
  assert.doesNotMatch(text, /pausad/i)
})

test('sem SMTP, nada é enviado e nada explode', async () => {
  clearSmtpEnv()
  assert.equal(isEmailConfigured(), false)
  assert.deepEqual(await sendMail({ to: 'a@b.com', subject: 'oi', text: 'oi' }), { skipped: true })

  const result = await sendTemplateEmail({
    db: emptyDb,
    sendMail,
    slug: 'afiliado_aprovado',
    user: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', status: 'active' },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(result.sent, false)
  assert.equal(result.reason, 'smtp_disabled')
})

test('endereço de fallback nunca recebe, mesmo com SMTP ligado', async () => {
  const enviados = []
  const result = await sendTemplateEmail({
    db: emptyDb,
    sendMail: async (msg) => { enviados.push(msg); return { skipped: false } },
    slug: 'afiliado_aprovado',
    user: { id: 'u1', name: 'Ana', email: 'user_ab12@sistema.com', status: 'active' },
    now: NOW,
    logger: silentLogger,
  })
  assert.equal(result.reason, 'undeliverable_user')
  assert.equal(enviados.length, 0)
})
