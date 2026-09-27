// A preferência do pagamento avulso leva os dados do pagador e o item completo
// (recusas "rejected_high_risk" em cartão avulso, 27/09/2026).
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildCheckoutPayer, buildCheckoutItem, splitBrazilianPhone, splitPayerName } from '../src/domain/payments/checkoutPayer.js'

test('nome vira first_name/last_name; nome único repete', () => {
  assert.deepEqual(splitPayerName('Maria da Silva'), { first_name: 'Maria', last_name: 'da Silva' })
  assert.deepEqual(splitPayerName('  Maria '), { first_name: 'Maria', last_name: 'Maria' })
  assert.equal(splitPayerName(''), null)
})

test('telefone brasileiro em vários formatos vira DDD + número; lixo vira null', () => {
  assert.deepEqual(splitBrazilianPhone('+55 (11) 91234-5678'), { area_code: '11', number: '912345678' })
  assert.deepEqual(splitBrazilianPhone('5531988887777'), { area_code: '31', number: '988887777' })
  assert.deepEqual(splitBrazilianPhone('3133334444'), { area_code: '31', number: '33334444' })
  assert.equal(splitBrazilianPhone('123'), null)
  assert.equal(splitBrazilianPhone(null), null)
})

test('pagador só leva o que existe e é válido; sem nada, null', () => {
  const p = buildCheckoutPayer({ name: 'Ana Souza', email: 'ana@exemplo.com', phone: '+55 21 99999-0000' })
  assert.deepEqual(p, { first_name: 'Ana', last_name: 'Souza', email: 'ana@exemplo.com', phone: { area_code: '21', number: '999990000' } })
  assert.deepEqual(buildCheckoutPayer({ name: 'Ana', email: 'nao-e-email', phone: 'x' }), { first_name: 'Ana', last_name: 'Ana' })
  assert.equal(buildCheckoutPayer({}), null)
  // Nunca inventamos CPF ou endereço.
  assert.equal('identification' in (p ?? {}), false)
  assert.equal('address' in (p ?? {}), false)
})

test('item completo: id por plano, descrição, categoria services, preço do plano', () => {
  const item = buildCheckoutItem({ plan: 'pro', title: 'Pro', price: 69 })
  assert.equal(item.id, 'espelha-grupos-pro')
  assert.equal(item.category_id, 'services')
  assert.match(item.description, /plano Pro/)
  assert.equal(item.unit_price, 69)
  assert.equal(item.quantity, 1)
})

test('a rota do checkout avulso monta pagador e item com os módulos puros', () => {
  const rota = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  assert.match(rota, /buildCheckoutPayer\(/)
  assert.match(rota, /buildCheckoutItem\(/)
  const inicio = rota.indexOf('async function createMercadoPagoPreference')
  const bloco = rota.slice(inicio, rota.indexOf("'https://api.mercadopago.com/checkout/preferences'", inicio))
  assert.match(bloco, /payer/)
})
