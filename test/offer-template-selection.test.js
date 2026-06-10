import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CRIAR_OFERTA_DEFAULT_TEMPLATE_KEY,
  resolveSelectedTemplate,
} from '../dashboard/lib/offerTemplateSelection.js'

const TEMPLATES = [
  { key: 'automatico_classico', name: 'Automático clássico', body: 'A' },
  { key: 'simples', name: 'Simples', body: 'B' },
  { key: 'tpl_123', name: 'Meu template', body: 'C', isCustom: true },
]

test('sem chave salva, cai no default automatico_classico', () => {
  const selected = resolveSelectedTemplate(TEMPLATES, '')
  assert.equal(selected.key, CRIAR_OFERTA_DEFAULT_TEMPLATE_KEY)
})

test('chave salva válida (inclusive customizada) é respeitada', () => {
  assert.equal(resolveSelectedTemplate(TEMPLATES, 'simples').key, 'simples')
  assert.equal(resolveSelectedTemplate(TEMPLATES, 'tpl_123').key, 'tpl_123')
})

test('chave salva de template deletado cai no default silenciosamente', () => {
  const selected = resolveSelectedTemplate(TEMPLATES, 'tpl_apagado')
  assert.equal(selected.key, CRIAR_OFERTA_DEFAULT_TEMPLATE_KEY)
})

test('lista sem o default usa o primeiro template disponível', () => {
  const onlyCustom = [{ key: 'tpl_9', name: 'X', body: 'Y' }]
  assert.equal(resolveSelectedTemplate(onlyCustom, 'inexistente').key, 'tpl_9')
})

test('lista vazia ou inválida devolve null', () => {
  assert.equal(resolveSelectedTemplate([], 'simples'), null)
  assert.equal(resolveSelectedTemplate(null, 'simples'), null)
  assert.equal(resolveSelectedTemplate([{ name: 'sem key' }], ''), null)
})
