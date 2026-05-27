import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT,
  toggleTemplateVisibility,
  getConversionStatusPresentation,
  buildOfferPriceBlocks,
} from '../dashboard/lib/offerBuilderUi.js'

test('template inicia oculto por padrão', () => {
  assert.equal(OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT, false)
})

test('clicar em editar template alterna estado de visibilidade', () => {
  assert.equal(toggleTemplateVisibility(false), true)
  assert.equal(toggleTemplateVisibility(true), false)
})

test('status verde quando conversão é sucesso', () => {
  const view = getConversionStatusPresentation({ attempted: true, success: true })
  assert.equal(view.tone, 'success')
  assert.equal(view.title, '✅ Link convertido com sucesso.')
  assert.match(view.hint, /link de afiliado/i)
})

test('status vermelho quando conversão falha', () => {
  const view = getConversionStatusPresentation({
    attempted: true,
    success: false,
    reasonCode: 'MISSING_CREDENTIALS',
  })
  assert.equal(view.tone, 'danger')
  assert.match(view.title, /link não convertido/i)
  assert.match(view.hint, /credenciais/i)
})

test('quando só existir um preço, mensagem usa apenas "Por" sem bloco "De"', () => {
  const fromOldOnly = buildOfferPriceBlocks({
    oldPrice: '79,00',
    newPrice: '',
    formatPrice: (v) => `R$ ${v}`,
  })
  assert.equal(fromOldOnly.oldPriceBlock, '')
  assert.equal(fromOldOnly.newPriceBlock, '\n💥 Por R$ 79,00')

  const fromNewOnly = buildOfferPriceBlocks({
    oldPrice: '',
    newPrice: '33,18',
    formatPrice: (v) => `R$ ${v}`,
  })
  assert.equal(fromNewOnly.oldPriceBlock, '')
  assert.equal(fromNewOnly.newPriceBlock, '\n💥 Por R$ 33,18')
})

test('quando existir preço antigo e atual, mantém "De" + "Por"', () => {
  const both = buildOfferPriceBlocks({
    oldPrice: '79,00',
    newPrice: '33,18',
    formatPrice: (v) => `R$ ${v}`,
  })
  assert.equal(both.oldPriceBlock, '\n\nDe R$ 79,00')
  assert.equal(both.newPriceBlock, '\n💥 Por R$ 33,18')
})
