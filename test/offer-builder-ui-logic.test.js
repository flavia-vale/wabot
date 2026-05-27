import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT,
  toggleTemplateVisibility,
  getConversionStatusPresentation,
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
