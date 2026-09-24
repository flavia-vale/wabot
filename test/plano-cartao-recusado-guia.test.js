import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CARD_HELP_TITLE, CARD_HELP_PIX_TEXT, CARD_HELP_PIX_BUTTON, buildCardPaymentSteps,
} from '../src/domain/painel/cardPaymentHelp.js'

test('guia do cartão recusado cobre crédito, e-mail, repetição e banco', () => {
  const steps = buildCardPaymentSteps({ accountEmail: 'denia@exemplo.com' }).join(' ')
  assert.match(steps, /CRÉDITO/)
  assert.match(steps, /débito/)
  assert.match(steps, /denia@exemplo\.com/)
  assert.match(steps, /Não repita o mesmo cartão/)
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
  const tudo = [CARD_HELP_TITLE, CARD_HELP_PIX_TEXT, ...buildCardPaymentSteps({ accountEmail: 'a@b.com' })].join(' ')
  assert.doesNotMatch(tudo, /preapproval|antifraude|gateway|checkout|token|webhook/i)
})

test('a aba Planos mostra o guia e abre sozinho quando a tentativa falha', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')
  assert.match(page, /buildCardPaymentSteps\(\{ accountEmail: user\?\.email \}\)/)
  assert.match(page, /open=\{Boolean\(checkoutError\)/)
  assert.match(page, /setBillingMode\('once'\); handleCheckout\(selectedPlanId\)/)
})
