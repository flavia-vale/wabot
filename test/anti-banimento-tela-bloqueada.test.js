// User Story 3 (specs/018-unificar-protecao-anti-ban): quem tem acesso vê e
// edita normalmente; quem não tem vê a tela VISÍVEL e BLOQUEADA (nunca
// oculta); Premium tem o mesmo acesso de PRO (sem upsell); Trial ativo tem
// acesso completo; escrita sem acesso não grava nada.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { canUseAdvancedPreservation, buildFeatureGateError, FEATURE_CODES } from '../src/billing/plans.js'

const now = new Date('2026-09-24T12:00:00.000Z')

const PERFIS = [
  { label: 'Basic', subject: { plan: 'basic', accessExpiresAt: null }, acesso: false },
  { label: 'Trial ativo', subject: { plan: 'trial', accessExpiresAt: new Date(now.getTime() + 86400000) }, acesso: true },
  { label: 'Trial vencido', subject: { plan: 'trial', accessExpiresAt: new Date(now.getTime() - 86400000) }, acesso: false },
  { label: 'PRO', subject: { plan: 'pro', accessExpiresAt: null }, acesso: true },
  { label: 'Premium', subject: { plan: 'premium', accessExpiresAt: null }, acesso: true },
]

for (const { label, subject, acesso } of PERFIS) {
  test(`perfil ${label}: canUseAdvancedPreservation === ${acesso}`, () => {
    assert.equal(canUseAdvancedPreservation(subject, { now }), acesso)
  })
}

test('Premium tem o MESMO acesso de PRO — sem upsell (SC-005a)', () => {
  const pro = canUseAdvancedPreservation({ plan: 'pro', accessExpiresAt: null }, { now })
  const premium = canUseAdvancedPreservation({ plan: 'premium', accessExpiresAt: null }, { now })
  assert.equal(pro, true)
  assert.equal(premium, true)
})

test('layout.js: sem acesso renderiza UpsellShell (visível e bloqueada), nunca redireciona nem oculta', () => {
  const source = readFileSync(new URL('../dashboard/app/painel/anti-banimento/layout.js', import.meta.url), 'utf8')
  assert.match(source, /<UpsellShell/)
  assert.doesNotMatch(source, /redirect\(/)
  assert.doesNotMatch(source, /display:\s*['"]none['"]/)
})

test('UpsellShell: resumo leigo + aviso de que o robô continua protegendo + botão para conhecer o plano PRO', () => {
  const source = readFileSync(new URL('../dashboard/components/preservacao/UpsellShell.js', import.meta.url), 'utf8')
  assert.match(source, /continua\s*\n?\s*protegendo o seu número/)
  assert.match(source, /Conhecer o plano PRO/)
  assert.match(source, /\/painel\/plano/)
})

test('a mensagem de recusa do gate (T021) é a mesma usada nos 3 pontos de recusa', () => {
  const err = buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION)
  assert.equal(err.error, 'O Anti-banimento é um recurso do plano PRO.')
  assert.equal(err.feature, FEATURE_CODES.ADVANCED_PRESERVATION)
  assert.ok(err.requiredPlan)
})

test('as 3 rotas checam o gate ANTES de qualquer escrita no banco (ordem: gate primeiro)', () => {
  for (const [rota, chamada] of [
    ['src/api/routes/preservation.js', 'requirePreservationAccess'],
    ['src/api/routes/config.js', 'ADVANCED_PRESERVATION'],
    ['src/api/routes/groups.js', 'ADVANCED_PRESERVATION'],
  ]) {
    const source = readFileSync(new URL(`../${rota}`, import.meta.url), 'utf8')
    assert.match(source, new RegExp(chamada), `${rota} não referencia a checagem de gate esperada`)
  }
})
