import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decideDuplicateTrialSignal,
  normalizeSignupName,
  emailRoot,
  MIN_EMAIL_ROOT_LENGTH,
} from '../src/domain/signup/duplicateTrialSignal.js'

const DIA = 24 * 60 * 60 * 1000
const dia = (offset) => new Date(Date.now() + offset * DIA)

test('nome comparável ignora acento, caixa e espaço dobrado', () => {
  assert.equal(normalizeSignupName('RAELY DA  Sílva SANTOS'), 'raely da silva santos')
  assert.equal(normalizeSignupName('  '), null)
})

test('raiz do e-mail derruba dígitos e separadores do fim', () => {
  assert.equal(emailRoot('castelloisabella22@gmail.com'), 'castelloisabella')
  assert.equal(emailRoot('castelloisabella4@gmail.com'), 'castelloisabella')
  assert.equal(emailRoot('flaviaroberta.140006@gmail.com'), 'flaviaroberta')
})

test('a cadeia real do Castello é reconhecida pela raiz do e-mail', () => {
  const r = decideDuplicateTrialSignal({
    novo: { id: 'novo', name: 'Graziela da Silva Castello Moreira', email: 'castelloisabella4@gmail.com', createdAt: dia(0) },
    anteriores: [
      { id: 'a', name: 'Samuel Castello Dutra', email: 'castelloisabella22@gmail.com', accessExpiresAt: dia(-1) },
      { id: 'b', name: 'Victor Hugo Silva', email: 'castelloisabella2@gmail.com', accessExpiresAt: dia(-8) },
    ],
  })
  assert.equal(r.suspeito, true)
  assert.equal(r.motivo, 'mesma raiz de e-mail')
  assert.equal(r.contas.length, 2)
})

test('conta criada ANTES do vencimento da anterior também conta', () => {
  // O caso que motivou a investigação: as duas contas novas nasceram um dia
  // antes de o teste antigo acabar. Exigir "depois" deixaria passar.
  const r = decideDuplicateTrialSignal({
    novo: { id: 'novo', name: 'jilsimara oliveira dos santos', email: 'pointdobolases@gmail.com', createdAt: dia(0) },
    anteriores: [
      { id: 'a', name: 'jilsimara oliveira dos santos', email: 'maraliv2013@gmail.com', accessExpiresAt: dia(1) },
    ],
  })
  assert.equal(r.suspeito, true)
  assert.equal(r.motivo, 'mesmo nome')
})

test('raiz curta NÃO acusa sozinha — é prefixo de meio mundo', () => {
  assert.ok('lucas'.length < MIN_EMAIL_ROOT_LENGTH)
  const r = decideDuplicateTrialSignal({
    novo: { id: 'novo', name: 'Lucas Dias', email: 'lucas2011@gmail.com', createdAt: dia(0) },
    anteriores: [
      { id: 'a', name: 'Lucas Schroeder', email: 'lucas1997@gmail.com', accessExpiresAt: dia(-2) },
    ],
  })
  assert.equal(r.suspeito, false)
})

test('vencimento fora da janela não acusa', () => {
  const r = decideDuplicateTrialSignal({
    novo: { id: 'novo', name: 'Carine Cristina da silva', email: 'carinecristina130@gmail.com', createdAt: dia(0) },
    anteriores: [
      { id: 'a', name: 'Carine Cristina da silva', email: 'carinecristina710@gmail.com', accessExpiresAt: dia(-200) },
    ],
  })
  assert.equal(r.suspeito, false)
})

test('fail-safe: dado faltando nunca vira acusação', () => {
  assert.equal(decideDuplicateTrialSignal().suspeito, false)
  assert.equal(decideDuplicateTrialSignal({ novo: { name: 'Alguem', email: 'a@b.com' } }).suspeito, false)
  assert.equal(decideDuplicateTrialSignal({
    novo: { name: 'Alguem', email: 'alguem123@b.com', createdAt: dia(0) },
    anteriores: [{ id: 'a', name: 'Alguem', email: 'alguem999@b.com', accessExpiresAt: null }],
  }).suspeito, false)
})

test('a própria conta não é comparada consigo mesma', () => {
  const r = decideDuplicateTrialSignal({
    novo: { id: 'x', name: 'Fulana', email: 'fulanadetal@b.com', createdAt: dia(0) },
    anteriores: [{ id: 'x', name: 'Fulana', email: 'fulanadetal@b.com', accessExpiresAt: dia(-1) }],
  })
  assert.equal(r.suspeito, false)
})
