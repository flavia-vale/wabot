import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeContactPhone, fixStoredContactPhone } from '../src/domain/signup/contactPhone.js'

test('número nacional ganha o código do país', () => {
  assert.equal(normalizeContactPhone('(11) 95391-5457'), '+5511953915457')
  assert.equal(normalizeContactPhone('11953915457'), '+5511953915457')
  // Fixo/celular antigo, 8 dígitos depois do DDD.
  assert.equal(normalizeContactPhone('7399016561'), '+557399016561')
})

test('DDD 55 não pode ser confundido com o código do país', () => {
  // A regra é por COMPRIMENTO. Se fosse por prefixo, este número de Santa Maria
  // ficaria sem o país e viraria um endereço que não existe no WhatsApp.
  assert.equal(normalizeContactPhone('5599998888'), '+555599998888')
  assert.equal(normalizeContactPhone('55999998888'), '+5555999998888')
})

test('número que já tem o país é preservado', () => {
  assert.equal(normalizeContactPhone('+55 11 95391-5457'), '+5511953915457')
  assert.equal(normalizeContactPhone('557399016561'), '+557399016561')
})

test('número estrangeiro NÃO ganha país inventado', () => {
  assert.equal(normalizeContactPhone('351912345678'), '+351912345678')
  assert.equal(normalizeContactPhone('12025550123'), '+5512025550123', '11 dígitos é lido como nacional — limite conhecido')
})

test('o que não parece telefone continua sendo recusado', () => {
  for (const invalido of ['', null, undefined, 'abc', '123', '1'.repeat(16)]) {
    assert.equal(normalizeContactPhone(invalido), null, `deveria recusar: ${invalido}`)
  }
})

test('a varredura só mexe no que de fato falta país', () => {
  assert.deepEqual(fixStoredContactPhone('+11953915457'), {
    changed: true, value: '+5511953915457', reason: 'faltava_o_pais',
  })
  assert.deepEqual(fixStoredContactPhone('+5511953915457'), {
    changed: false, value: '+5511953915457', reason: 'ja_tem_pais',
  })
  // Estrangeiro e fora de padrão ficam como estão — corrigir por palpite
  // trocaria o número de contato de uma cliente por outro.
  assert.equal(fixStoredContactPhone('+351912345678').changed, false)
  assert.equal(fixStoredContactPhone('').changed, false)
})

test('o cadastro usa a função única, sem cópia local', () => {
  const auth = readFileSync(new URL('../src/api/routes/auth.js', import.meta.url), 'utf8')
  assert.match(auth, /from '\.\.\/\.\.\/domain\/signup\/contactPhone\.js'/)
  assert.doesNotMatch(auth, /^function normalizeContactPhone/m, 'a cópia local traz o defeito de volta')
})
