import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  decidePendingSubscriptionReuse,
  SUBSCRIPTION_REUSE_MAX_AGE_MS,
} from '../src/domain/payments/subscriptionPolicy.js'
import {
  classifyMpAccessTokenMode,
  isSandboxTokenInProduction,
  SANDBOX_TOKEN_USER_MESSAGE,
} from '../src/domain/payments/accessTokenMode.js'

const AGORA = new Date('2026-09-07T10:00:00Z')
const pendente = (over = {}) => ({
  status: 'pending',
  plan: 'pro',
  mpSubscriptionId: 'preapproval-1',
  createdAt: new Date('2026-09-07T09:50:00Z'),
  updatedAt: new Date('2026-09-07T09:50:00Z'),
  ...over,
})

test('reaproveita o checkout em aberto do mesmo plano em vez de criar outro igual', () => {
  const d = decidePendingSubscriptionReuse({ subscription: pendente(), plan: 'pro', now: AGORA })
  assert.equal(d.reuse, true)
  assert.equal(d.reason, 'reusable_pending')
})

test('sem checkout em aberto, cria um novo', () => {
  assert.equal(decidePendingSubscriptionReuse({ subscription: null, plan: 'pro', now: AGORA }).reuse, false)
})

test('assinatura já valendo nunca é reaproveitada como checkout', () => {
  const d = decidePendingSubscriptionReuse({ subscription: pendente({ status: 'authorized' }), plan: 'pro', now: AGORA })
  assert.equal(d.reuse, false)
  assert.equal(d.reason, 'not_pending')
})

test('trocar de plano cria checkout novo (o valor cobrado é outro)', () => {
  const d = decidePendingSubscriptionReuse({ subscription: pendente({ plan: 'basic' }), plan: 'pro', now: AGORA })
  assert.equal(d.reuse, false)
  assert.equal(d.reason, 'plan_changed')
})

test('checkout em aberto NUNCA trava a conta: fora da janela, cria um novo', () => {
  const velho = pendente({
    createdAt: new Date(AGORA.getTime() - SUBSCRIPTION_REUSE_MAX_AGE_MS - 1000),
    updatedAt: new Date(AGORA.getTime() - SUBSCRIPTION_REUSE_MAX_AGE_MS - 1000),
  })
  const d = decidePendingSubscriptionReuse({ subscription: velho, plan: 'pro', now: AGORA })
  assert.equal(d.reuse, false)
  assert.equal(d.reason, 'too_old')
})

test('sem identificador do provedor ou sem data confiável, cria um novo', () => {
  assert.equal(decidePendingSubscriptionReuse({ subscription: pendente({ mpSubscriptionId: null }), plan: 'pro', now: AGORA }).reason, 'no_provider_id')
  assert.equal(decidePendingSubscriptionReuse({ subscription: pendente({ createdAt: null, updatedAt: null }), plan: 'pro', now: AGORA }).reason, 'no_timestamp')
})

test('modo da chave do Mercado Pago', () => {
  assert.equal(classifyMpAccessTokenMode('TEST-123'), 'test')
  assert.equal(classifyMpAccessTokenMode('APP_USR-123'), 'live')
  assert.equal(classifyMpAccessTokenMode('  '), 'missing')
  assert.equal(classifyMpAccessTokenMode('outra-coisa'), 'unknown')
})

test('chave de teste só acusa em produção; prefixo desconhecido nunca acusa', () => {
  assert.equal(isSandboxTokenInProduction({ token: 'TEST-1', isProduction: true }), true)
  assert.equal(isSandboxTokenInProduction({ token: 'TEST-1', isProduction: false }), false)
  assert.equal(isSandboxTokenInProduction({ token: 'APP_USR-1', isProduction: true }), false)
  assert.equal(isSandboxTokenInProduction({ token: 'novo-prefixo', isProduction: true }), false)
})

test('a frase da chave errada não culpa o cartão da cliente nem usa jargão', () => {
  for (const jargao of ['sandbox', 'token', 'gateway', 'preapproval', 'access']) {
    assert.ok(!SANDBOX_TOKEN_USER_MESSAGE.toLowerCase().includes(jargao), `jargão "${jargao}" chegou à tela`)
  }
  assert.match(SANDBOX_TOKEN_USER_MESSAGE, /não pelo seu cartão/i)
})

const rota = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')

test('o preapproval manda notification_url (senão o aviso de renovação depende só do painel do MP)', () => {
  const bloco = rota.slice(rota.indexOf('https://api.mercadopago.com/preapproval\''), rota.indexOf('createMercadoPagoPreference'))
  assert.match(bloco, /notification_url:/)
})

test('a rota tenta reaproveitar o checkout ANTES de criar outro', () => {
  const inicio = rota.indexOf("app.post('/create-subscription'")
  const trecho = rota.slice(inicio, inicio + 4000)
  const posReuso = trecho.indexOf('decidePendingSubscriptionReuse')
  const posCriacao = trecho.indexOf('await createMercadoPagoSubscription')
  assert.ok(posReuso > -1, 'a rota não consulta a política de reaproveitamento')
  assert.ok(posReuso < posCriacao, 'o reaproveitamento precisa vir antes da criação')
})
