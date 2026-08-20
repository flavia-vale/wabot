import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { resolveGroupImageMode, DEFAULT_GROUP_IMAGE_MODE } from '../src/core/imageModePolicy.js'

// 2026-08-20: com o Mercado Livre barrando o IP do servidor, parte das ofertas
// voltou a sair sem foto no modo preview. A troca para "imagem que veio na
// mensagem" (`original`) é global e por env — não reescreve escolha no banco e
// volta apagando a linha do `.env`.

test('sem env, o modo continua sendo o histórico (preview)', () => {
  assert.equal(resolveGroupImageMode({}), 'preview')
  assert.equal(DEFAULT_GROUP_IMAGE_MODE, 'preview')
})

test('a env troca o modo de todos os grupos de uma vez', () => {
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'original' }), 'original')
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: ' ORIGINAL ' }), 'original')
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'fetch' }), 'fetch')
})

test('valor inválido não deixa o pipeline sem modo', () => {
  // `.env` mal preenchido não pode virar oferta sem imagem nem erro de envio.
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'qualquer' }), 'preview')
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: '' }), 'preview')
  assert.equal(resolveGroupImageMode(), 'preview')
})

// A invariante do chokepoint não mudou: o valor persistido em `Group.imageMode`
// continua sem ser lido no caminho de envio (specs/001-image-mode-preview-default,
// FR-001/FR-009). Guarda estrutural para ninguém "reativar" o campo por engano.
test('o chokepoint não volta a ler o imageMode persistido do grupo', () => {
  const source = readFileSync(new URL('../src/billing/groupEntitlements.js', import.meta.url), 'utf8')
  const fnStart = source.indexOf('function toMonitorGroup(')
  const fnEnd = source.indexOf('function toPostDetail(')
  const fn = source.slice(fnStart, fnEnd)
  assert.match(fn, /imageMode: resolveGroupImageMode\(\)/)
  assert.equal(/imageMode: group\.imageMode/.test(fn), false)
})
