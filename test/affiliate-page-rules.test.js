import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../dashboard/app/painel/afiliados/page.js', import.meta.url), 'utf8')

test('página de afiliados explicita comissão, hold, reembolso e link exclusivo', () => {
  assert.match(source, /Você recebe <strong>\{commissionPercent\}% de comissão<\/strong>/)
  assert.match(source, /Regra de repasse e segurança \(estorno\/reembolso\)/)
  assert.match(source, /\{holdDays\} dias após o pagamento do cliente/)
  assert.match(source, /caso o usuário peça reembolso/)
  assert.match(source, /cliente indicado precisa obrigatoriamente se cadastrar usando o seu link exclusivo/)
  assert.match(source, /https:\/\/espelhagrupos\.com\.br\/painel\/afiliados/)
})

test('config pública de afiliados é consumida no painel para evitar percentual hardcoded', () => {
  assert.match(source, /api\.affiliateConfig\(\)/)
  assert.match(source, /commissionHoldDays/)
  assert.match(source, /attributionWindowDays/)
})


test('fluxo de cadastro registra touch anônimo e envia visitorId para associação pós-cadastro', () => {
  const loginSource = readFileSync(new URL('../dashboard/app/login/page.js', import.meta.url), 'utf8')
  const apiSource = readFileSync(new URL('../dashboard/lib/api.js', import.meta.url), 'utf8')
  const routeSource = readFileSync(new URL('../src/api/routes/affiliate.js', import.meta.url), 'utf8')
  const authSource = readFileSync(new URL('../src/api/routes/auth.js', import.meta.url), 'utf8')

  assert.match(loginSource, /getOrCreateAffiliateVisitorId/)
  assert.match(loginSource, /api\.affiliateTrack/)
  assert.match(loginSource, /affiliateVisitorId/)
  assert.match(apiSource, /affiliateTrack: \(data\) => apiFetch\('\/api\/affiliate\/track'/)
  assert.match(routeSource, /app\.post\('\/affiliate\/track'/)
  assert.match(authSource, /attachAffiliateAttributionTouchesToUser/)
})

test('painel diferencia saldo pago, a liberar, disponível e estornado', () => {
  assert.match(source, /Saldo a liberar/)
  assert.match(source, /Disponível para saque/)
  assert.match(source, /Total pago/)
  assert.match(source, /Estornado\/revertido/)
  assert.match(source, /MonthStatusBadge/)
})

test('webhook de pagamento reverte comissão em reembolso ou chargeback', () => {
  const paymentsRouteSource = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  assert.match(paymentsRouteSource, /isReversiblePaymentStatus/)
  assert.match(paymentsRouteSource, /reverseAffiliateCommissionForPayment/)
  assert.match(paymentsRouteSource, /payment_reversed/)
  assert.match(paymentsRouteSource, /affiliate_commission_reversed/)
})
