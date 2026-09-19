// Voucher de desconto para quem deixou o acesso vencer.
//
// O que estes testes travam é a única coisa que faz a ideia funcionar sem tabela
// nenhuma: o código do segundo e-mail ser o MESMO do primeiro, e dar para
// conferir depois um código que chegou por WhatsApp. Se a derivação deixar de
// ser determinística, a cliente recebe dois códigos diferentes e nenhum confere
// com o que a administradora regenera — o desconto vira discussão.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RECOVERY_VOUCHER_PERCENT,
  RECOVERY_VOUCHER_VALID_DAYS,
  buildRecoveryVoucher,
  buildRecoveryVoucherCode,
  checkRecoveryVoucher,
} from '../src/domain/payments/recoveryVoucher.js'

const DAY = 24 * 60 * 60 * 1000
const VENCEU = new Date('2026-09-12T03:00:00Z')
const ENV = { VOUCHER_CODE_SECRET: 'segredo-de-teste' }

test('o código é o mesmo para a mesma conta e o mesmo vencimento', () => {
  const a = buildRecoveryVoucherCode({ userId: 'u42', expiredAt: VENCEU, env: ENV })
  const b = buildRecoveryVoucherCode({ userId: 'u42', expiredAt: new Date(VENCEU.getTime() + 6 * 60 * 60 * 1000), env: ENV })
  assert.match(a, /^VOLTA20-[23456789ACDEFGHJKLMNPQRTUVWXYZ]{6}$/)
  assert.equal(b, a, 'a hora do dia não pode mudar o código')
})

test('contas diferentes recebem códigos diferentes', () => {
  const a = buildRecoveryVoucherCode({ userId: 'u1', expiredAt: VENCEU, env: ENV })
  const b = buildRecoveryVoucherCode({ userId: 'u2', expiredAt: VENCEU, env: ENV })
  assert.notEqual(a, b)
})

// O código é lido em voz alta e digitado por outra pessoa: O/0, I/1, S/5 e B/8
// viram erro de digitação e discussão sobre desconto.
test('o código não usa caractere que a pessoa erra ao ditar', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = buildRecoveryVoucherCode({ userId: `u${i}`, expiredAt: VENCEU, env: ENV })
    assert.doesNotMatch(code.split('-')[1], /[OISB01]/, code)
  }
})

test('sem conta ou sem data de vencimento não existe voucher', () => {
  assert.equal(buildRecoveryVoucherCode({ userId: '', expiredAt: VENCEU, env: ENV }), null)
  assert.equal(buildRecoveryVoucherCode({ userId: 'u1', expiredAt: null, env: ENV }), null)
  assert.equal(buildRecoveryVoucherCode({ userId: 'u1', expiredAt: 'qualquer coisa', env: ENV }), null)
  assert.equal(buildRecoveryVoucher({ userId: 'u1', expiredAt: null, env: ENV }), null)
})

// O prazo conta do VENCIMENTO, não do envio: é o que faz o e-mail do 7º dia
// dizer um prazo coerente com o do 5º, mesmo quando a passada diária atrasa.
test('o prazo é contado do vencimento do acesso', () => {
  const noQuinto = buildRecoveryVoucher({ userId: 'u1', expiredAt: VENCEU, now: new Date(VENCEU.getTime() + 5 * DAY), env: ENV })
  const noSetimo = buildRecoveryVoucher({ userId: 'u1', expiredAt: VENCEU, now: new Date(VENCEU.getTime() + 7 * DAY), env: ENV })
  assert.equal(noQuinto.percent, RECOVERY_VOUCHER_PERCENT)
  assert.equal(noQuinto.diasRestantes, RECOVERY_VOUCHER_VALID_DAYS - 5)
  assert.equal(noSetimo.diasRestantes, 3)
  assert.equal(noSetimo.validUntil.getTime(), noQuinto.validUntil.getTime())
})

test('passado o prazo o voucher não vale mais', () => {
  const tarde = buildRecoveryVoucher({ userId: 'u1', expiredAt: VENCEU, now: new Date(VENCEU.getTime() + 11 * DAY), env: ENV })
  assert.ok(tarde.diasRestantes <= 0)
})

// ------------------------------------------------------- conferência manual

test('a conferência aceita o código da conta e recusa o de outra', () => {
  const now = new Date(VENCEU.getTime() + 6 * DAY)
  const code = buildRecoveryVoucherCode({ userId: 'u1', expiredAt: VENCEU, env: ENV })
  const outra = buildRecoveryVoucherCode({ userId: 'u2', expiredAt: VENCEU, env: ENV })

  assert.equal(checkRecoveryVoucher({ code, userId: 'u1', expiredAt: VENCEU, now, env: ENV }).valido, true)
  assert.equal(checkRecoveryVoucher({ code: code.toLowerCase(), userId: 'u1', expiredAt: VENCEU, now, env: ENV }).valido, true)
  const errada = checkRecoveryVoucher({ code: outra, userId: 'u1', expiredAt: VENCEU, now, env: ENV })
  assert.equal(errada.valido, false)
  assert.equal(errada.motivo, 'codigo_diferente')
})

test('a conferência separa "não é o código" de "o prazo passou"', () => {
  const code = buildRecoveryVoucherCode({ userId: 'u1', expiredAt: VENCEU, env: ENV })
  const tarde = checkRecoveryVoucher({ code, userId: 'u1', expiredAt: VENCEU, now: new Date(VENCEU.getTime() + 30 * DAY), env: ENV })
  assert.equal(tarde.valido, false)
  assert.equal(tarde.motivo, 'prazo_vencido', 'as duas recusas pedem respostas opostas para a cliente')
})
