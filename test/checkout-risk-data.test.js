import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildCheckoutPayer,
  buildCheckoutItem,
  parseBrazilianPhone,
  CHECKOUT_ITEM_CATEGORY,
} from '../src/domain/payments/checkoutRiskData.js'
import { describeChargeStatusDetail, CHARGE_ACTION_OWNERS } from '../src/domain/payments/chargeOutcome.js'

test('manda nome, sobrenome, e-mail e telefone reais da compradora', () => {
  const payer = buildCheckoutPayer({ name: 'Maria da Silva Souza', email: 'maria@gmail.com', contactPhone: '+55 (11) 98765-4321' })
  assert.deepEqual(payer, {
    name: 'Maria',
    surname: 'da Silva Souza',
    email: 'maria@gmail.com',
    phone: { area_code: '11', number: '987654321' },
  })
})

test('nome de uma palavra só vai sem sobrenome', () => {
  assert.deepEqual(buildCheckoutPayer({ name: 'Maria' }), { name: 'Maria' })
})

test('e-mail de preenchimento automático não vai — dado falso piora a nota de risco', () => {
  const payer = buildCheckoutPayer({ name: 'Ana', email: 'user_abc@sistema.com' })
  assert.equal(payer.email, undefined)
  assert.equal(buildCheckoutPayer({ email: 'nao-e-email' }), null)
})

test('telefone fora do padrão brasileiro não vai', () => {
  assert.equal(parseBrazilianPhone('12345'), null)
  assert.equal(parseBrazilianPhone('011987654321'), null)
  assert.equal(parseBrazilianPhone(null), null)
  assert.deepEqual(parseBrazilianPhone('5521912345678'), { area_code: '21', number: '912345678' })
  assert.deepEqual(parseBrazilianPhone('2133334444'), { area_code: '21', number: '33334444' })
})

test('sem nenhum dado confiável não inventa compradora', () => {
  assert.equal(buildCheckoutPayer({}), null)
  assert.equal(buildCheckoutPayer(), null)
})

test('item leva id, descrição e categoria além de título e preço', () => {
  const item = buildCheckoutItem({ plan: 'pro', title: 'Plano Pro', price: 69 })
  assert.equal(item.id, 'plano-pro')
  assert.equal(item.category_id, CHECKOUT_ITEM_CATEGORY)
  assert.ok(item.description.includes('Plano Pro'))
  assert.equal(item.unit_price, 69)
  assert.equal(item.quantity, 1)
})

test('rejected_high_risk (Pix/saldo) é recusa por suspeita, não "motivo desconhecido"', () => {
  const d = describeChargeStatusDetail('rejected_high_risk')
  assert.equal(d.known, true)
  assert.equal(d.owner, CHARGE_ACTION_OWNERS.NOSSA)
  assert.doesNotMatch(d.label, /antifraude|gateway/i)
})

test('guarda estrutural: a preferência do avulso manda payer e item completo', () => {
  const rota = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  const bloco = rota.slice(rota.indexOf('async function createMercadoPagoPreference'), rota.indexOf('checkout/preferences'))
  assert.match(bloco, /buildCheckoutPayer\(/)
  assert.match(bloco, /buildCheckoutItem\(/)
  assert.match(bloco, /\.\.\.\(payer \? \{ payer \} : \{\}\)/)
})

test('avulso usa o e-mail preenchido em PLANOS — o mesmo campo dos dois botões', () => {
  const rota = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  const bloco = rota.slice(rota.indexOf('async function createMercadoPagoPreference'), rota.indexOf('checkout/preferences'))
  assert.match(bloco, /resolveSubscriptionPayerEmail\(\{ accountEmail: buyer\?\.email, informedEmail \}\)/)
  const rotaCheckout = rota.slice(rota.indexOf("app.post('/checkout'"), rota.indexOf("app.post('/create-subscription'"))
  assert.match(rotaCheckout, /informedEmail: payerEmail/)

  const tela = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')
  assert.match(tela, /api\.paymentsCheckout\(planId, mpEmail\.trim\(\) \|\| undefined\)/)
  const api = readFileSync(new URL('../dashboard/lib/api.js', import.meta.url), 'utf8')
  assert.match(api, /paymentsCheckout: \(plan, payerEmail\) =>/)
})

test('e-mail preenchido ganha do da conta; inválido não vai (e não bloqueia o avulso)', async () => {
  const { resolveSubscriptionPayerEmail } = await import('../src/domain/payments/payerEmail.js')
  const preenchido = resolveSubscriptionPayerEmail({ accountEmail: 'conta@gmail.com', informedEmail: 'mp@gmail.com' })
  assert.equal(buildCheckoutPayer({ email: preenchido.email }).email, 'mp@gmail.com')
  const vazio = resolveSubscriptionPayerEmail({ accountEmail: 'conta@gmail.com', informedEmail: '' })
  assert.equal(buildCheckoutPayer({ email: vazio.email }).email, 'conta@gmail.com')
  const invalido = resolveSubscriptionPayerEmail({ accountEmail: 'conta@gmail.com', informedEmail: 'xx' })
  assert.equal(buildCheckoutPayer({ name: 'Ana', email: invalido.email }).email, undefined)
})
