import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PARTNER_COURTESY_REASON_PREFIX,
  buildPartnerCourtesyReason,
  isPartnerCourtesyReason,
  normalizePartnerCode,
  parsePartnerCourtesyCode,
} from '../src/ops/partnerCourtesy.js'

test('normalizePartnerCode aceita código válido e normaliza para minúsculas', () => {
  assert.equal(normalizePartnerCode('RAFAELE10'), 'rafaele10')
  assert.equal(normalizePartnerCode('  lex-coelho  '), 'lex-coelho')
  assert.equal(normalizePartnerCode('artur_rampazio'), 'artur_rampazio')
})

test('normalizePartnerCode rejeita valor que não serve como código', () => {
  assert.equal(normalizePartnerCode(''), '')
  assert.equal(normalizePartnerCode(null), '')
  assert.equal(normalizePartnerCode('-comeca-com-hifen'), '')
  assert.equal(normalizePartnerCode('com espaço'), '')
  assert.equal(normalizePartnerCode('com:dois-pontos'), '')
  assert.equal(normalizePartnerCode('a'.repeat(33)), '')
})

test('buildPartnerCourtesyReason grava o formato canônico com o motivo do admin', () => {
  const reason = buildPartnerCourtesyReason('LEX-COELHO', 'cortesia de 90 dias da parceria')
  assert.equal(reason, 'parceiro-influenciador:lex-coelho — cortesia de 90 dias da parceria')
  assert.ok(reason.startsWith(`${PARTNER_COURTESY_REASON_PREFIX}:`))
})

test('buildPartnerCourtesyReason sem código devolve o motivo cru (fluxo normal do CS)', () => {
  assert.equal(buildPartnerCourtesyReason('', 'compensação por indisponibilidade'), 'compensação por indisponibilidade')
  assert.equal(buildPartnerCourtesyReason(undefined, ' estender trial '), 'estender trial')
})

test('buildPartnerCourtesyReason é idempotente na renovação (não empilha prefixo)', () => {
  const primeira = buildPartnerCourtesyReason('lex-coelho', 'cortesia inicial')
  const renovacao = buildPartnerCourtesyReason('lex-coelho', primeira)
  assert.equal(renovacao, primeira)
})

test('parsePartnerCourtesyCode devolve o código, inclusive com hífen no código', () => {
  assert.equal(parsePartnerCourtesyCode('parceiro-influenciador:lex-coelho — cortesia inicial'), 'lex-coelho')
  assert.equal(parsePartnerCourtesyCode('parceiro-influenciador:rafaele10'), 'rafaele10')
})

test('parsePartnerCourtesyCode ignora motivo livre do CS', () => {
  assert.equal(parsePartnerCourtesyCode('compensação por queda de sessão'), '')
  assert.equal(parsePartnerCourtesyCode(''), '')
  assert.equal(parsePartnerCourtesyCode(null), '')
  assert.equal(parsePartnerCourtesyCode('parceiro-influenciador:'), '')
})

test('isPartnerCourtesyReason separa cortesia de parceria de ajuste normal', () => {
  assert.equal(isPartnerCourtesyReason(buildPartnerCourtesyReason('artur', 'cortesia 90d')), true)
  assert.equal(isPartnerCourtesyReason('reembolso de cobrança duplicada'), false)
})
