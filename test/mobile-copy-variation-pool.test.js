import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePool, writePool, countPool } from '../dashboard/lib/mobileCopyVariationPool.js'

test('parsePool retorna struct vazio para null', () => {
  const result = parsePool(null)
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('parsePool retorna struct vazio para undefined', () => {
  const result = parsePool(undefined)
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('parsePool retorna struct vazio para string vazia', () => {
  const result = parsePool('')
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('parsePool retorna struct vazio para JSON inválido', () => {
  const result = parsePool('{ greetings: não é json }')
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('parsePool retorna struct vazio para array JSON', () => {
  const result = parsePool('["a","b"]')
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('parsePool retorna struct vazio para string primitiva JSON', () => {
  const result = parsePool('"apenas string"')
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('parsePool normaliza chaves presentes corretamente', () => {
  const input = JSON.stringify({ greetings: ['Olá', 'Oi'], ctas: ['Compre agora'], trailers: [] })
  const result = parsePool(input)
  assert.deepEqual(result, { greetings: ['Olá', 'Oi'], ctas: ['Compre agora'], trailers: [] })
})

test('parsePool preenche chaves ausentes com arrays vazios', () => {
  const input = JSON.stringify({ greetings: ['Olá'] })
  const result = parsePool(input)
  assert.deepEqual(result, { greetings: ['Olá'], ctas: [], trailers: [] })
})

test('parsePool filtra não-strings de arrays', () => {
  const input = JSON.stringify({ greetings: ['Olá', 42, null, 'Oi', true], ctas: [], trailers: [] })
  const result = parsePool(input)
  assert.deepEqual(result, { greetings: ['Olá', 'Oi'], ctas: [], trailers: [] })
})

test('parsePool normaliza chave não-array para array vazio', () => {
  const input = JSON.stringify({ greetings: 'não é array', ctas: [], trailers: [] })
  const result = parsePool(input)
  assert.deepEqual(result, { greetings: [], ctas: [], trailers: [] })
})

test('writePool retorna string vazia quando todas as arrays estão vazias', () => {
  assert.equal(writePool({ greetings: [], ctas: [], trailers: [] }), '')
})

test('writePool retorna string vazia para pool null', () => {
  assert.equal(writePool(null), '')
})

test('writePool serializa pool com itens', () => {
  const pool = { greetings: ['Olá'], ctas: ['Compre'], trailers: ['Até logo'] }
  const result = writePool(pool)
  assert.equal(result, JSON.stringify({ greetings: ['Olá'], ctas: ['Compre'], trailers: ['Até logo'] }))
})

test('writePool trima strings e filtra vazias', () => {
  const pool = { greetings: ['  Olá  ', '', '  '], ctas: ['Compre'], trailers: [] }
  const result = writePool(pool)
  assert.equal(result, JSON.stringify({ greetings: ['Olá'], ctas: ['Compre'], trailers: [] }))
})

test('writePool retorna string vazia quando só há strings em branco', () => {
  const pool = { greetings: ['   ', ''], ctas: ['  '], trailers: [] }
  assert.equal(writePool(pool), '')
})

test('round-trip parse(write(pool)) preserva conteúdo', () => {
  const original = { greetings: ['Olá', 'Oi'], ctas: ['Compre agora', 'Aproveite'], trailers: ['Até logo'] }
  const serialized = writePool(original)
  const recovered = parsePool(serialized)
  assert.deepEqual(recovered, original)
})

test('countPool soma totais corretamente', () => {
  const pool = { greetings: ['a', 'b'], ctas: ['c'], trailers: ['d', 'e', 'f'] }
  const result = countPool(pool)
  assert.deepEqual(result, { greetings: 2, ctas: 1, trailers: 3, total: 6 })
})

test('countPool tolera pool null retornando zeros', () => {
  const result = countPool(null)
  assert.deepEqual(result, { greetings: 0, ctas: 0, trailers: 0, total: 0 })
})

test('countPool tolera arrays ausentes', () => {
  const result = countPool({})
  assert.deepEqual(result, { greetings: 0, ctas: 0, trailers: 0, total: 0 })
})

test('countPool com pool vazio retorna zeros', () => {
  const result = countPool({ greetings: [], ctas: [], trailers: [] })
  assert.deepEqual(result, { greetings: 0, ctas: 0, trailers: 0, total: 0 })
})
