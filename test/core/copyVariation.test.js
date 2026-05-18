import test from 'node:test'
import assert from 'node:assert/strict'

import { applyVariation, pickVariant } from '../../src/core/copyVariation.js'

const POOL = {
  greetings: ['', '🔥 ', '💥 ', '⚡ '],
  ctas: ['Confira:', 'Pega já:', 'Olha essa:', 'Não perde:'],
  trailers: ['', ' 👀', ' 💸', ' 🎯'],
}

test('applyVariation sem pool retorna texto original', () => {
  const out = applyVariation('Texto puro', { groupId: 'g-1' })
  assert.equal(out, 'Texto puro')
})

test('applyVariation substitui placeholders pelo pool', () => {
  const tpl = '{{greeting}}{{cta}} https://ex.com{{trailer}}'
  const out = applyVariation(tpl, { groupId: 'g-1', pool: POOL, date: '2026-05-18' })
  // determinístico: mesma combinação groupId+date → mesma escolha
  const out2 = applyVariation(tpl, { groupId: 'g-1', pool: POOL, date: '2026-05-18' })
  assert.equal(out, out2)
  // não deve sobrar placeholder
  assert.equal(out.includes('{{'), false)
  assert.ok(out.includes('https://ex.com'))
})

test('applyVariation muda escolha quando muda groupId ou date', () => {
  const tpl = '{{greeting}}{{cta}}{{trailer}}'
  const a = applyVariation(tpl, { groupId: 'g-1', pool: POOL, date: '2026-05-18' })
  const b = applyVariation(tpl, { groupId: 'g-2', pool: POOL, date: '2026-05-18' })
  const c = applyVariation(tpl, { groupId: 'g-1', pool: POOL, date: '2026-05-19' })
  // pelo menos 1 dos pares precisa diferir (probabilístico mas com 4 opções
  // a chance de bater todos é baixa; este teste valida sensibilidade)
  assert.ok(a !== b || a !== c, `esperava variação entre destinos/dias; a=${a} b=${b} c=${c}`)
})

test('applyVariation prefixa greeting + sufixa trailer quando NÃO há placeholders', () => {
  const out = applyVariation('Texto puro', { groupId: 'g-1', pool: POOL, date: '2026-05-18' })
  // resultado tem o texto no meio
  assert.ok(out.includes('Texto puro'))
})

test('applyVariation aceita pool serializado como JSON', () => {
  const tpl = '{{greeting}}X'
  const out = applyVariation(tpl, { groupId: 'g-1', poolJson: JSON.stringify(POOL), date: '2026-05-18' })
  assert.ok(out.endsWith('X'))
})

test('pickVariant: bucket vazio retorna empty string', () => {
  assert.equal(pickVariant([], 'g-1', '2026-05-18'), '')
  assert.equal(pickVariant(null, 'g-1', '2026-05-18'), '')
})

test('pickVariant: bucket de 1 sempre retorna o único item', () => {
  assert.equal(pickVariant(['X'], 'g-1', '2026-05-18'), 'X')
})

test('pickVariant: determinístico por (groupId, date)', () => {
  const arr = ['a', 'b', 'c', 'd']
  const v1 = pickVariant(arr, 'g-1', '2026-05-18')
  const v2 = pickVariant(arr, 'g-1', '2026-05-18')
  assert.equal(v1, v2)
})
