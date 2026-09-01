import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SUBSCRIPTION_OPEN_STATUSES,
  blocksNewSubscription,
  decideAccessExtensionFromSubscription,
  decideSubscriptionCancellation,
  describeSubscriptionStatus,
  isSubscriptionActive,
  summarizeSubscriptionForPanel,
} from '../src/domain/payments/subscriptionPolicy.js'

const NOW = new Date('2026-09-01T12:00:00Z')

test('só `authorized` conta como assinatura cobrando', () => {
  assert.equal(isSubscriptionActive('authorized'), true)
  assert.equal(isSubscriptionActive('AUTHORIZED'), true)
  for (const status of ['pending', 'paused', 'cancelled', '', null, undefined, 'qualquer']) {
    assert.equal(isSubscriptionActive(status), false, `status ${status} não pode contar como ativa`)
  }
})

test('assinatura ativa bloqueia criar outra; pendente NÃO bloqueia', () => {
  assert.equal(blocksNewSubscription({ status: 'authorized' }), true)
  // checkout aberto e abandonado não pode travar a conta para sempre
  assert.equal(blocksNewSubscription({ status: 'pending' }), false)
  assert.equal(blocksNewSubscription({ status: 'cancelled' }), false)
  assert.equal(blocksNewSubscription(null), false)
})

test('cancelamento é idempotente e não inventa erro', () => {
  assert.deepEqual(decideSubscriptionCancellation({ status: 'authorized' }), { ok: true, reason: 'ok' })
  assert.deepEqual(decideSubscriptionCancellation({ status: 'pending' }), { ok: true, reason: 'ok' })
  assert.deepEqual(decideSubscriptionCancellation({ status: 'cancelled' }), { ok: false, reason: 'already_cancelled' })
  assert.deepEqual(decideSubscriptionCancellation(null), { ok: false, reason: 'not_found' })
})

test('estende o acesso quando ele vence ANTES da próxima cobrança', () => {
  const decision = decideAccessExtensionFromSubscription({
    status: 'authorized',
    nextChargeAt: '2026-09-20T12:00:00Z',
    accessExpiresAt: '2026-09-05T12:00:00Z',
    now: NOW,
  })
  assert.equal(decision.extend, true)
  assert.equal(decision.until.toISOString(), '2026-09-20T12:00:00.000Z')
})

test('conta sem acesso registrado e com assinatura cobrando também é estendida', () => {
  const decision = decideAccessExtensionFromSubscription({
    status: 'authorized',
    nextChargeAt: '2026-09-20T12:00:00Z',
    accessExpiresAt: null,
    now: NOW,
  })
  assert.equal(decision.extend, true)
  assert.equal(decision.reason, 'no_access_recorded')
})

test('NUNCA encurta acesso já pago', () => {
  const decision = decideAccessExtensionFromSubscription({
    status: 'authorized',
    nextChargeAt: '2026-09-10T12:00:00Z',
    accessExpiresAt: '2026-10-30T12:00:00Z',
    now: NOW,
  })
  assert.equal(decision.extend, false)
  assert.equal(decision.reason, 'already_covered')
  assert.equal(decision.until, null)
})

test('assinatura que não está cobrando nunca estende acesso', () => {
  for (const status of ['cancelled', 'paused', 'pending', null]) {
    const decision = decideAccessExtensionFromSubscription({
      status,
      nextChargeAt: '2026-12-01T12:00:00Z',
      accessExpiresAt: '2026-09-02T12:00:00Z',
      now: NOW,
    })
    assert.equal(decision.extend, false, `status ${status} não pode estender acesso`)
    assert.equal(decision.reason, 'not_active')
  }
})

test('data de cobrança ausente, inválida ou no passado não estende nada', () => {
  for (const nextChargeAt of [null, undefined, '', 'não é data', '2026-08-01T12:00:00Z']) {
    const decision = decideAccessExtensionFromSubscription({
      status: 'authorized',
      nextChargeAt,
      accessExpiresAt: '2026-09-02T12:00:00Z',
      now: NOW,
    })
    assert.equal(decision.extend, false, `nextChargeAt ${nextChargeAt} não pode estender`)
  }
})

test('acesso com data inválida no banco não impede a extensão (fail-safe a favor da cliente)', () => {
  const decision = decideAccessExtensionFromSubscription({
    status: 'authorized',
    nextChargeAt: '2026-09-20T12:00:00Z',
    accessExpiresAt: 'lixo',
    now: NOW,
  })
  assert.equal(decision.extend, true)
})

test('resumo do painel: pendente não pode aparecer como renovação ligada', () => {
  const resumo = summarizeSubscriptionForPanel({ status: 'pending', plan: 'pro', nextChargeAt: '2026-09-20T12:00:00Z' })
  assert.equal(resumo.autoRenew, false)
  assert.equal(resumo.hasSubscription, true)
  assert.equal(resumo.canCancel, true)
})

test('resumo do painel sem assinatura nenhuma', () => {
  const resumo = summarizeSubscriptionForPanel(null)
  assert.deepEqual(resumo, {
    hasSubscription: false,
    autoRenew: false,
    status: null,
    statusLabel: 'Sem renovação automática',
    plan: null,
    nextChargeAt: null,
    cancelledAt: null,
    canCancel: false,
  })
})

test('resumo do painel não devolve identificador do provedor', () => {
  const resumo = summarizeSubscriptionForPanel({ status: 'authorized', plan: 'pro', mpSubscriptionId: 'preap-123' })
  assert.equal(JSON.stringify(resumo).includes('preap-123'), false)
})

test('linguagem leiga: nada de jargão do provedor na tela', () => {
  const textos = ['authorized', 'pending', 'paused', 'cancelled', null].map(describeSubscriptionStatus)
  for (const texto of textos) {
    assert.ok(texto.length > 0)
    assert.ok(!/preapproval|gateway|authorized|webhook|token/i.test(texto), `jargão vazando: ${texto}`)
  }
})

test('a passada de reconciliação olha as assinaturas ainda vivas', () => {
  assert.deepEqual([...SUBSCRIPTION_OPEN_STATUSES].sort(), ['authorized', 'paused', 'pending'])
})

// --- Guardas estruturais: o caminho de cobrança não pode regredir em silêncio ---

const paymentsSource = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')

test('a rota de cancelar só marca cancelado depois de o Mercado Pago aceitar', () => {
  const rota = paymentsSource.slice(paymentsSource.indexOf("app.post('/subscription/cancel'"))
  const trechoDaRota = rota.slice(0, rota.indexOf("app.post('/webhook'"))
  const posChamada = trechoDaRota.indexOf('cancelMercadoPagoSubscription(')
  const posUpdate = trechoDaRota.indexOf('db.subscription.update(')
  assert.ok(posChamada > 0, 'a rota precisa chamar o cancelamento no provedor')
  assert.ok(posUpdate > posChamada, 'não marcar como cancelada antes da confirmação do provedor')
  assert.ok(trechoDaRota.includes("'provider_not_found'"), 'assinatura que sumiu no provedor precisa ser tratada')
})

test('a reconciliação de assinatura roda no tick que já existe (sem processo novo)', () => {
  assert.ok(paymentsSource.includes('runSubscriptionReconciliation({ log: app.log })'))
  assert.ok(paymentsSource.includes('decideAccessExtensionFromSubscription('), 'a extensão precisa passar pela regra pura')
})

test('criar assinatura passa pela guarda de assinatura já ativa', () => {
  assert.ok(paymentsSource.includes('blocksNewSubscription(activeSubscription)'))
  assert.ok(paymentsSource.includes('SUBSCRIPTION_ALREADY_ACTIVE'))
})

const planoPageSource = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')

test('a tela oferece assinar E desligar — sem saída, a cobrança automática vira armadilha', () => {
  assert.ok(planoPageSource.includes('api.paymentsCreateSubscription'), 'a tela precisa chamar a criação de assinatura')
  assert.ok(planoPageSource.includes('api.paymentsCancelSubscription'), 'a tela precisa oferecer o cancelamento')
  assert.ok(/Desligar cobran/i.test(planoPageSource), 'o botão de desligar precisa estar visível na tela')
  assert.ok(planoPageSource.includes('needsEmailUpdate'), 'e-mail recusado pelo MP precisa ter conserto na própria tela')
})

test('desligar pede confirmação e explica que o acesso pago continua', () => {
  assert.ok(planoPageSource.includes("cancelState === 'confirming'"), 'cancelar não pode ser um clique só')
  assert.ok(/acesso continua at/i.test(planoPageSource), 'a tela precisa dizer que o acesso já pago continua')
})
