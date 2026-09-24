import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CARD_HELP_TITLE, CARD_HELP_PIX_TEXT, CARD_HELP_PIX_BUTTON, CARD_HELP_MP_EMAIL_TEXT, buildCardPaymentSteps,
} from '../src/domain/painel/cardPaymentHelp.js'
import { resolveSubscriptionPayerEmail, samePayerEmail } from '../src/domain/payments/payerEmail.js'

test('guia do cartão recusado cobre crédito, e-mail, repetição e banco', () => {
  const steps = buildCardPaymentSteps({ accountEmail: 'denia@exemplo.com' }).join(' ')
  assert.match(steps, /CRÉDITO/)
  assert.match(steps, /débito/)
  assert.match(steps, /denia@exemplo\.com/)
  assert.match(steps, /Não repita o mesmo cartão/)
  assert.match(steps, /costuma usar/)
  assert.match(steps, /banco/)
})

test('sem e-mail confiável o guia não inventa endereço', () => {
  for (const accountEmail of [undefined, null, '', 'sem-arroba']) {
    const steps = buildCardPaymentSteps({ accountEmail }).join(' ')
    assert.doesNotMatch(steps, /\(\S*\)/)
  }
})

test('o guia oferece o PIX como saída que não depende de cartão', () => {
  assert.match(CARD_HELP_PIX_TEXT, /PIX/)
  assert.match(CARD_HELP_PIX_BUTTON, /PIX/)
})

test('linguagem leiga: nada de jargão do provedor na tela', () => {
  const tudo = [CARD_HELP_TITLE, CARD_HELP_PIX_TEXT, CARD_HELP_MP_EMAIL_TEXT, ...buildCardPaymentSteps({ accountEmail: 'a@b.com' })].join(' ')
  assert.doesNotMatch(tudo, /preapproval|antifraude|gateway|checkout|token|webhook/i)
})

test('a aba Planos mostra o guia e abre sozinho quando a tentativa falha', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')
  assert.match(page, /buildCardPaymentSteps\(\{ accountEmail: user\?\.email \}\)/)
  assert.match(page, /open=\{Boolean\(checkoutError \|\| lastSubscribePlan\)/)
  // O atalho do PIX paga o plano que ela tentou, nunca um plano escolhido por nós.
  assert.match(page, /onClick=\{\(\) => handleCheckout\(lastSubscribePlan\)\}/)
})

test('e-mail informado para o Mercado Pago vai na cobrança sem mexer na conta', () => {
  const r = resolveSubscriptionPayerEmail({ accountEmail: 'conta@botinho.com', informedEmail: ' mp@hotmail.com ' })
  assert.deepEqual(r, { email: 'mp@hotmail.com', source: 'informed', issue: null })
})

test('sem e-mail informado, vale o da conta (comportamento histórico)', () => {
  const r = resolveSubscriptionPayerEmail({ accountEmail: 'conta@botinho.com', informedEmail: '' })
  assert.equal(r.email, 'conta@botinho.com')
  assert.equal(r.source, 'account')
  assert.equal(r.issue, null)
})

test('e-mail informado inválido é recusado com frase própria, e nunca cai no da conta em silêncio', () => {
  for (const informedEmail of ['sem-arroba', 'user_ab12@sistema.com']) {
    const r = resolveSubscriptionPayerEmail({ accountEmail: 'conta@botinho.com', informedEmail })
    assert.equal(r.source, 'informed')
    assert.ok(r.issue)
    assert.match(r.issue.message, /Mercado Pago que você informou/)
  }
})

test('conta com e-mail gerado continua barrada quando nada é informado', () => {
  const r = resolveSubscriptionPayerEmail({ accountEmail: 'user_ab12@sistema.com' })
  assert.equal(r.issue?.reason, 'fallback')
})

test('checkout em aberto só é reaproveitado para o MESMO e-mail', () => {
  assert.equal(samePayerEmail('A@x.com', 'a@x.com '), true)
  assert.equal(samePayerEmail('a@x.com', 'b@x.com'), false)
  assert.equal(samePayerEmail(null, 'a@x.com'), false)
  assert.equal(samePayerEmail('', ''), false)
})

test('a rota usa o e-mail informado e o reaproveitamento confere o e-mail', () => {
  const route = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  assert.match(route, /resolveSubscriptionPayerEmail\(\{ accountEmail: user\?\.email, informedEmail: informedPayerEmail \}\)/)
  assert.match(route, /samePayerEmail\(snapshot\.payerEmail, payerEmail\)/)
  // O vínculo com a conta é o userId, nunca o e-mail.
  assert.match(route, /external_reference: userId/)
  const page = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')
  assert.match(page, /paymentsCreateSubscription\(planId, mpEmail\.trim\(\) \|\| undefined\)/)
})
