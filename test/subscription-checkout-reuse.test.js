import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  decidePendingSubscriptionReuse,
  SUBSCRIPTION_REUSE_MAX_AGE_MS,
  decideSubscriptionAttemptCooldown,
  describeSubscriptionCooldown,
  SUBSCRIPTION_ATTEMPT_WINDOW_MS,
  SUBSCRIPTION_ATTEMPT_COOLDOWN_MS,
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

test('a janela conta do CHECKOUT, não da última escrita nossa na linha', () => {
  // `updatedAt` é `@updatedAt` no schema: a reconciliação horária e o webhook
  // renovam o campo sozinhos. Contando por ele, um checkout de 3 dias atrás
  // parecia recém-criado, a janela de 24h nunca expirava e a cliente voltava
  // para sempre ao mesmo link velho — além de o freio entre tentativas nunca
  // rodar, porque o reaproveitamento responde antes dele.
  const tocadoPelaReconciliacao = pendente({
    createdAt: new Date(AGORA.getTime() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(AGORA.getTime() - 60 * 1000),
  })
  const d = decidePendingSubscriptionReuse({ subscription: tocadoPelaReconciliacao, plan: 'pro', now: AGORA })
  assert.equal(d.reuse, false)
  assert.equal(d.reason, 'too_old')
})

test('sem `createdAt`, ainda decide pela última escrita em vez de recusar por dúvida', () => {
  const d = decidePendingSubscriptionReuse({ subscription: pendente({ createdAt: null }), plan: 'pro', now: AGORA })
  assert.equal(d.reuse, true)
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
  const trecho = rota.slice(inicio, inicio + 6000)
  const posReuso = trecho.indexOf('decidePendingSubscriptionReuse')
  const posCriacao = trecho.indexOf('await createMercadoPagoSubscription')
  assert.ok(posReuso > -1, 'a rota não consulta a política de reaproveitamento')
  assert.ok(posReuso < posCriacao, 'o reaproveitamento precisa vir antes da criação')
})

// ---------------------------------------------------------------------------
// Intervalo mínimo entre tentativas (RCA 2026-09-07, conta camilla_*)
// ---------------------------------------------------------------------------

const ATTEMPT_1 = new Date(1788782713313) // 09:05:13 BRT
const ATTEMPT_2 = new Date(1788782911311) // 09:08:31 BRT
const ATTEMPT_3 = new Date(1788786131304) // 10:02:11 BRT — a recusa do print
const CANCELADOS_EM = new Date(1788784364764) // 09:32:44 BRT, pela reconciliação

test('caso real: a TERCEIRA tentativa em 57min espera em vez de criar outro checkout', () => {
  // Os dois anteriores já tinham sido encerrados às 09:32 — não havia o que
  // reaproveitar, e era exatamente aí que nascia o checkout que foi recusado.
  const historico = [
    { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_2, updatedAt: CANCELADOS_EM },
    { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_1, updatedAt: CANCELADOS_EM },
  ]
  const d = decideSubscriptionAttemptCooldown({ recentSubscriptions: historico, plan: 'pro', now: ATTEMPT_3 })
  assert.equal(d.wait, true)
  assert.equal(d.reason, 'too_many_recent_attempts')
  assert.equal(d.attempts, 2)
  assert.ok(d.retryAt > ATTEMPT_3, 'a espera precisa apontar para o futuro')
})

test('a espera é LIMITADA: passado o intervalo, a pessoa tenta de novo', () => {
  const historico = [
    { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_2 },
    { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_1 },
  ]
  const depois = new Date(ATTEMPT_2.getTime() + SUBSCRIPTION_ATTEMPT_COOLDOWN_MS + 1000)
  assert.equal(decideSubscriptionAttemptCooldown({ recentSubscriptions: historico, plan: 'pro', now: depois }).wait, false)
})

test('uma tentativa só nunca espera', () => {
  const d = decideSubscriptionAttemptCooldown({
    recentSubscriptions: [{ plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_1 }],
    plan: 'pro',
    now: ATTEMPT_2,
  })
  assert.equal(d.wait, false)
  assert.equal(d.reason, 'under_limit')
})

test('tentativa de OUTRO plano não conta para a espera', () => {
  const historico = [
    { plan: 'basic', status: 'cancelled', createdAt: ATTEMPT_1 },
    { plan: 'basic', status: 'cancelled', createdAt: ATTEMPT_2 },
  ]
  assert.equal(decideSubscriptionAttemptCooldown({ recentSubscriptions: historico, plan: 'pro', now: ATTEMPT_3 }).wait, false)
})

test('tentativa velha (fora da janela) não conta', () => {
  const antiga = new Date(ATTEMPT_3.getTime() - SUBSCRIPTION_ATTEMPT_WINDOW_MS - 1000)
  const historico = [
    { plan: 'pro', status: 'cancelled', createdAt: antiga },
    { plan: 'pro', status: 'cancelled', createdAt: antiga },
  ]
  assert.equal(decideSubscriptionAttemptCooldown({ recentSubscriptions: historico, plan: 'pro', now: ATTEMPT_3 }).wait, false)
})

test('fail-safe: sem histórico confiável, com assinatura ativa ou com teto desligado, DEIXA tentar', () => {
  assert.equal(decideSubscriptionAttemptCooldown({ recentSubscriptions: null, plan: 'pro' }).wait, false)
  assert.equal(decideSubscriptionAttemptCooldown({ recentSubscriptions: [], plan: 'pro' }).wait, false)
  assert.equal(decideSubscriptionAttemptCooldown({
    recentSubscriptions: [
      { plan: 'pro', status: 'authorized', createdAt: ATTEMPT_1 },
      { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_2 },
    ],
    plan: 'pro',
    now: ATTEMPT_3,
  }).wait, false, 'assinatura valendo é assunto de blocksNewSubscription, não da espera')
  assert.equal(decideSubscriptionAttemptCooldown({
    recentSubscriptions: [
      { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_1 },
      { plan: 'pro', status: 'cancelled', createdAt: ATTEMPT_2 },
    ],
    plan: 'pro',
    now: ATTEMPT_3,
    maxAttempts: 0,
  }).wait, false, 'maxAttempts=0 é o escape hatch')
})

test('o texto da espera não culpa o cartão, diz quando voltar e oferece o avulso', () => {
  const texto = describeSubscriptionCooldown(new Date(Date.now() + 2 * 60 * 60 * 1000))
  assert.match(texto, /não é problema com o seu cartão/i)
  assert.match(texto, /avulso/i)
  assert.match(texto, /daqui a 2 horas/i)
  for (const jargao of ['preapproval', 'antifraude', 'gateway', 'cooldown', 'token', 'checkout']) {
    assert.ok(!texto.toLowerCase().includes(jargao), `jargão "${jargao}" chegou à tela`)
  }
})

test('a rota consulta a espera ANTES de criar o checkout no Mercado Pago', () => {
  const inicio = rota.indexOf("app.post('/create-subscription'")
  const trecho = rota.slice(inicio, inicio + 6000)
  const posEspera = trecho.indexOf('decideSubscriptionAttemptCooldown')
  const posCriacao = trecho.indexOf('await createMercadoPagoSubscription')
  assert.ok(posEspera > -1, 'a rota não consulta a política de espera')
  assert.ok(posEspera < posCriacao, 'a espera precisa vir antes da criação')
})
test('o evento de tentativa só é emitido quando um checkout NOVO nasce', () => {
  // Emitido cedo demais, ele contava junto o clique devolvido ao checkout em
  // aberto e o adiado pela espera — os três caminhos viravam um número só.
  const inicio = rota.indexOf("app.post('/create-subscription'")
  const trecho = rota.slice(inicio, inicio + 6000)
  const posEvento = trecho.indexOf("event: 'subscription_started'")
  const posReuso = trecho.indexOf('decidePendingSubscriptionReuse')
  const posEspera = trecho.indexOf('decideSubscriptionAttemptCooldown')
  const posCriacao = trecho.indexOf('await createMercadoPagoSubscription')
  assert.ok(posEvento > -1, 'a rota não emite o evento de tentativa')
  assert.ok(posEvento > posReuso, 'o evento não pode contar o clique reaproveitado')
  assert.ok(posEvento > posEspera, 'o evento não pode contar o clique adiado')
  assert.ok(posEvento < posCriacao, 'o evento precisa sair antes da criação')
})

test('o diagnóstico pergunta o motivo ao Mercado Pago e não imprime a chave', () => {
  const diag = readFileSync(new URL('../scripts/diag-assinatura-recusada.mjs', import.meta.url), 'utf8')
  // A repetição de checkout explica a 2ª e a 3ª tentativa, nunca a primeira:
  // sem perguntar ao MP, o script conclui pela causa errada.
  assert.match(diag, /\/v1\/payments\//, 'não consulta o motivo da recusa')
  assert.match(diag, /\/preapproval\//, 'não consulta o estado do checkout')
  assert.match(diag, /cc_rejected_high_risk/, 'não traduz o motivo do antifraude')
  // Só o VALOR pode vazar: citar o nome da variável numa instrução é legítimo.
  for (const linha of diag.split('\n')) {
    if (!linha.includes('console.log')) continue
    assert.ok(!/\$\{[^}]*(MP_TOKEN|MP_ACCESS_TOKEN)/.test(linha), `a chave pode vazar nesta linha: ${linha.trim()}`)
  }
})
