import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PREREQ_KEYS,
  TOTAL_STEPS,
  countCompletedPrereqs,
  isBotActive,
  resolveOnboardingView,
  resolvePostAuthRedirect,
} from '../dashboard/lib/onboardingProgress.js'

const allDone = {
  waConnected: true,
  hasMonitorGroup: true,
  hasPostGroup: true,
  hasCredentials: true,
}

test('TOTAL_STEPS conta os 4 pré-requisitos + ativar', () => {
  assert.equal(PREREQ_KEYS.length, 4)
  assert.equal(TOTAL_STEPS, 5)
})

test('countCompletedPrereqs ignora chaves fora dos pré-requisitos', () => {
  assert.equal(countCompletedPrereqs(null), 0)
  assert.equal(countCompletedPrereqs({}), 0)
  assert.equal(countCompletedPrereqs({ ...allDone, hasSuccessfulLog: false }), 4)
  assert.equal(countCompletedPrereqs({ waConnected: true }), 1)
})

test('isBotActive exige status carregado e todos os pré-requisitos', () => {
  assert.equal(isBotActive(null), false)
  assert.equal(isBotActive(undefined), false)
  assert.equal(isBotActive(allDone), true)
  assert.equal(isBotActive({ ...allDone, waConnected: false }), false)
})

test('persist sempre mostra a lista, independente do resto', () => {
  assert.equal(resolveOnboardingView({ status: null, doneBefore: true, persist: true }), 'list')
  assert.equal(resolveOnboardingView({ status: allDone, doneBefore: true, persist: true }), 'list')
})

test('fluxo fresco: lista enquanto configura', () => {
  assert.equal(resolveOnboardingView({ status: null, doneBefore: false, persist: false, phase: 'list' }), 'list')
  assert.equal(resolveOnboardingView({ status: { waConnected: true }, doneBefore: false, persist: false, phase: 'list' }), 'list')
})

test('fluxo fresco: celebração e hidden têm precedência sobre o status', () => {
  assert.equal(resolveOnboardingView({ status: allDone, doneBefore: false, persist: false, phase: 'celebrate' }), 'celebrate')
  assert.equal(resolveOnboardingView({ status: allDone, doneBefore: false, persist: false, phase: 'hidden' }), 'hidden')
})

test('já concluiu + tudo ok → escondido (sem reabrir nem celebrar de novo)', () => {
  assert.equal(resolveOnboardingView({ status: allDone, doneBefore: true, persist: false, phase: 'list' }), 'hidden')
})

test('já concluiu + status ainda carregando → escondido (não pisca)', () => {
  assert.equal(resolveOnboardingView({ status: null, doneBefore: true, persist: false, phase: 'list' }), 'hidden')
})

test('já concluiu + WhatsApp caiu → recovery (a checklist volta para guiar a reconexão)', () => {
  const regressed = { ...allDone, waConnected: false }
  assert.equal(resolveOnboardingView({ status: regressed, doneBefore: true, persist: false, phase: 'list' }), 'recovery')
})

test('recovery cede para celebrate/hidden se a máquina de fases já avançou', () => {
  const regressed = { ...allDone, waConnected: false }
  assert.equal(resolveOnboardingView({ status: regressed, doneBefore: true, persist: false, phase: 'celebrate' }), 'celebrate')
  assert.equal(resolveOnboardingView({ status: regressed, doneBefore: true, persist: false, phase: 'hidden' }), 'hidden')
})

test('login de cliente já ativo nasce no painel, não no checklist', () => {
  assert.equal(resolvePostAuthRedirect({ status: allDone, isRegister: false }), '/painel')
})

test('cadastro e login incompleto continuam indo para checklist', () => {
  assert.equal(resolvePostAuthRedirect({ status: allDone, isRegister: true }), '/painel/checklist')
  assert.equal(resolvePostAuthRedirect({ status: { ...allDone, hasCredentials: false }, isRegister: false }), '/painel/checklist')
  assert.equal(resolvePostAuthRedirect({ status: null, isRegister: false }), '/painel/checklist')
})
