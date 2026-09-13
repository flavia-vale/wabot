import test from 'node:test'
import assert from 'node:assert/strict'
import { validateOfferAutomationForm } from '../dashboard/lib/offerAutomationForm.js'

const valid = {
  keyword: 'fone bluetooth',
  destGroupJid: '120@g.us',
  instagramDestinationIds: [],
  intervalMinutes: 240,
  dailyRunTime: '09:00',
  publicationMode: 'direct',
  reviewTargetSize: 10,
}

test('formulário válido pode ser salvo', () => {
  assert.equal(validateOfferAutomationForm(valid), null)
})

test('salvar explica cada campo obrigatório em vez de ser um clique sem resposta', () => {
  assert.equal(validateOfferAutomationForm({ ...valid, keyword: ' ' }), 'Escreva o que você quer vender.')
  assert.equal(validateOfferAutomationForm({ ...valid, destGroupJid: '' }), 'Escolha pelo menos um grupo ou destino do Instagram.')
  assert.equal(validateOfferAutomationForm({ ...valid, intervalMinutes: 1440, dailyRunTime: '' }), 'Escolha um horário válido para o envio diário.')
})

test('Instagram sozinho é destino válido e revisão valida o tamanho da fila', () => {
  assert.equal(validateOfferAutomationForm({ ...valid, destGroupJid: '', instagramDestinationIds: ['ig-1'] }), null)
  assert.equal(validateOfferAutomationForm({ ...valid, publicationMode: 'review', reviewTargetSize: 2 }), 'Escolha quantas ofertas quer guardar para revisão.')
})
