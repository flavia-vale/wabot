import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePixKey } from '../src/domain/affiliate/pixKeyValidation.js'

// 009-affiliate-improvements-r1 (US3): validatePixKey é módulo puro (sem
// acesso a DB/env) — cobre válidos/inválidos para os 4 tipos de chave PIX.

test('cpf: válido com dígito verificador correto', () => {
  assert.equal(validatePixKey({ pixKey: '11144477735', pixKeyType: 'cpf' }).ok, true)
})

test('cpf: válido com máscara (pontos/traço)', () => {
  assert.equal(validatePixKey({ pixKey: '111.444.777-35', pixKeyType: 'cpf' }).ok, true)
})

test('cpf: inválido com dígito verificador errado', () => {
  const result = validatePixKey({ pixKey: '12345678900', pixKeyType: 'cpf' })
  assert.equal(result.ok, false)
  assert.match(result.error, /CPF inválido/)
})

test('cpf: inválido com sequência repetida', () => {
  assert.equal(validatePixKey({ pixKey: '11111111111', pixKeyType: 'cpf' }).ok, false)
})

test('phone: válido em E.164 BR', () => {
  assert.equal(validatePixKey({ pixKey: '+5511987654321', pixKeyType: 'phone' }).ok, true)
})

test('phone: válido com máscara', () => {
  assert.equal(validatePixKey({ pixKey: '+55 (11) 98765-4321', pixKeyType: 'phone' }).ok, true)
})

test('phone: inválido sem DDD/código do país', () => {
  const result = validatePixKey({ pixKey: '987654321', pixKeyType: 'phone' })
  assert.equal(result.ok, false)
  assert.match(result.error, /formato brasileiro/)
})

test('phone: inválido sem o 9 do celular', () => {
  assert.equal(validatePixKey({ pixKey: '+551187654321', pixKeyType: 'phone' }).ok, false)
})

test('email: válido', () => {
  assert.equal(validatePixKey({ pixKey: 'a@b.com', pixKeyType: 'email' }).ok, true)
})

test('email: inválido sem @', () => {
  assert.equal(validatePixKey({ pixKey: 'not-an-email', pixKeyType: 'email' }).ok, false)
})

test('random: válido como UUID v4', () => {
  assert.equal(validatePixKey({ pixKey: '550e8400-e29b-41d4-a716-446655440000', pixKeyType: 'random' }).ok, true)
})

test('random: válido como EVP 32 hex', () => {
  assert.equal(validatePixKey({ pixKey: 'abcdefabcdefabcdefabcdefabcdef12', pixKeyType: 'random' }).ok, true)
})

test('random: inválido sem formato reconhecido', () => {
  assert.equal(validatePixKey({ pixKey: 'not-a-valid-random-key', pixKeyType: 'random' }).ok, false)
})

test('chave vazia é sempre inválida', () => {
  assert.equal(validatePixKey({ pixKey: '  ', pixKeyType: 'email' }).ok, false)
})
