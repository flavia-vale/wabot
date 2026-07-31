import test from 'node:test'
import assert from 'node:assert/strict'
import { NURTURE_STEPS, buildNurtureEmail } from '../src/email/nurtureEmails.js'

test('NURTURE_STEPS define exatamente 4 passos (0, 2, 5, 7)', () => {
  assert.deepEqual(NURTURE_STEPS.map((s) => s.step), [0, 2, 5, 7])
})

for (const step of [0, 2, 5, 7]) {
  test(`buildNurtureEmail passo ${step}: contém unsubscribeUrl em text e html, marca BOTinho, pt-BR`, () => {
    const { subject, text, html } = buildNurtureEmail(step, {
      name: 'Flávia Vale',
      unsubscribeUrl: 'https://exemplo.com/api/lead-nurture/unsubscribe?token=abc.def',
      dashboardUrl: 'https://exemplo.com',
    })
    assert.ok(subject.length > 0)
    assert.match(subject, /BOTinho/)
    assert.match(text, /BOTinho/)
    assert.match(html, /BOTinho/)
    assert.match(text, /https:\/\/exemplo\.com\/api\/lead-nurture\/unsubscribe\?token=abc\.def/)
    assert.match(html, /https:\/\/exemplo\.com\/api\/lead-nurture\/unsubscribe\?token=abc\.def/)
  })
}

test('buildNurtureEmail usa o primeiro nome na saudação', () => {
  const { text } = buildNurtureEmail(2, {
    name: 'Flávia Vale',
    unsubscribeUrl: 'https://exemplo.com/unsub',
    dashboardUrl: 'https://exemplo.com',
  })
  assert.match(text, /Olá, Flávia!/)
})

test('buildNurtureEmail sem nome usa saudação genérica', () => {
  const { text } = buildNurtureEmail(5, {
    name: '',
    unsubscribeUrl: 'https://exemplo.com/unsub',
    dashboardUrl: 'https://exemplo.com',
  })
  assert.match(text, /^Olá!/)
})

test('buildNurtureEmail lança para passo desconhecido', () => {
  assert.throws(() => buildNurtureEmail(3, { unsubscribeUrl: 'https://exemplo.com/unsub' }))
})
