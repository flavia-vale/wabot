import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyVariation } from '../src/core/copyVariation.js'

const pool = {
  greetings: ['Gancho!'],
  ctas: ['CTA aqui:'],
  trailers: ['Fechamento.'],
}

describe('applyVariation — placeholders de links', () => {
  it('substitui {{grupoLink}} pelo groupInviteLink', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Entre aqui: {{grupoLink}}'
    const result = applyVariation(text, { pool: pool2, groupInviteLink: 'https://chat.wa.me/abc', couponLink: '' })
    assert.equal(result, 'Entre aqui: https://chat.wa.me/abc')
  })

  it('substitui {{cupomLink}} pelo couponLink', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Cupom: {{cupomLink}}'
    const result = applyVariation(text, { pool: pool2, groupInviteLink: '', couponLink: 'https://cupom.io/x' })
    assert.equal(result, 'Cupom: https://cupom.io/x')
  })

  it('remove placeholder quando link está vazio', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Link: {{grupoLink}}'
    const result = applyVariation(text, { pool: pool2, groupInviteLink: '', couponLink: '' })
    assert.equal(result, 'Link: ')
  })

  it('substitui ambos os placeholders no mesmo texto', () => {
    const pool2 = { greetings: [], ctas: [], trailers: [] }
    const text = 'Grupo: {{grupoLink}} | Cupom: {{cupomLink}}'
    const result = applyVariation(text, {
      pool: pool2,
      groupInviteLink: 'https://grupo.wa',
      couponLink: 'https://cupom.io',
    })
    assert.equal(result, 'Grupo: https://grupo.wa | Cupom: https://cupom.io')
  })

  it('preserva comportamento existente sem os novos opts', () => {
    const text = 'Produto\n\n👉 https://shopee.com/p'
    const result = applyVariation(text, { pool, random: true })
    assert.ok(result.includes('Gancho!'))
    assert.ok(result.includes('CTA aqui:'))
    assert.ok(result.includes('Fechamento.'))
  })
})
