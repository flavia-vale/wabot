// Tela de decisão do teste (dia 5): regra pura de src/domain/painel/trialDecision.js.
// Dado que a motiva: 111 ativaram e 29 abriram o pagamento em 30 dias (27/09).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTrialDecisionScreen,
  decisionDayKey,
  TRIAL_DECISION_FROM_DAYS_LEFT,
} from '../src/domain/painel/trialDecision.js'

const DAY = 24 * 60 * 60 * 1000
// Meio-dia em São Paulo para não cair em virada de dia.
const now = new Date('2026-09-27T15:00:00.000Z')
const base = {
  plan: 'trial',
  offersPublished: 47,
  destGroupCount: 3,
  basicPriceCents: 3900,
  proPriceCents: 6900,
  now,
}

test('aparece a partir do dia 5 (faltam 2 dias), não antes', () => {
  assert.equal(TRIAL_DECISION_FROM_DAYS_LEFT, 2)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() + 3 * DAY) }), null)
  const tela = buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() + 2 * DAY) })
  assert.ok(tela)
  assert.equal(tela.daysLeft, 2)
  assert.match(tela.headline, /em 2 dias/)
})

test('no dia do vencimento diz "hoje"; vencido não aparece', () => {
  const hoje = buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) })
  assert.match(hoje.headline, /acaba hoje/)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() - 1000) }), null)
})

test('sem prova (zero ofertas) ou prova desconhecida não pede a venda', () => {
  const exp = new Date(now.getTime() + 1 * DAY)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: exp, offersPublished: 0 }), null)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: exp, offersPublished: null }), null)
})

test('só plano trial', () => {
  const exp = new Date(now.getTime() + 1 * DAY)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: exp, plan: 'basic' }), null)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: exp, plan: 'pro' }), null)
})

test('uma vez por dia de calendário', () => {
  const exp = new Date(now.getTime() + 1 * DAY)
  const dia = decisionDayKey(now)
  assert.equal(buildTrialDecisionScreen({ ...base, accessExpiresAt: exp, lastShownDay: dia }), null)
  const ontem = decisionDayKey(new Date(now.getTime() - DAY))
  assert.ok(buildTrialDecisionScreen({ ...base, accessExpiresAt: exp, lastShownDay: ontem }))
})

test('prova em trabalho poupado e preço na conta dela, com a configuração preservada', () => {
  const tela = buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() + 1 * DAY) })
  assert.equal(tela.messagesSaved, 141)
  assert.match(tela.proof, /47 ofertas em 3 grupos: 141 mensagens/)
  assert.match(tela.priceLine, /Basic sai por R\$\s?0,83 por oferta e o Pro por R\$\s?1,47/)
  assert.match(tela.preserved, /continuam salvos/)
  assert.equal(tela.ctaHref, '/painel/plano')
})

test('sem preço confiável, a linha de preço some em vez de sair errada', () => {
  const tela = buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() + 1 * DAY), basicPriceCents: null, proPriceCents: null })
  assert.equal(tela.priceLine, null)
  assert.ok(tela.proof)
})

test('sem grupo de destino conhecido, não infla: fala só das ofertas', () => {
  const tela = buildTrialDecisionScreen({ ...base, accessExpiresAt: new Date(now.getTime() + 1 * DAY), destGroupCount: 0 })
  assert.equal(tela.messagesSaved, 47)
  assert.doesNotMatch(tela.proof, /mensagens que você não precisou/)
})
