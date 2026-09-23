import test from 'node:test'
import assert from 'node:assert/strict'
import { degradeFor, DELIVERY_REDUCTION } from '../src/core/delivery/neutralOffer.js'

// Feature 017 (arquitetura multicanal de entrega), FR-007/FR-008, US7
// cenários 2 e 3: as decisões saem SÓ da declaração de capacidades da rede,
// nunca de uma condição escrita para uma rede específica. Uma rede que
// EXIGE imagem sinaliza a falta dela pelo mesmo caminho de degradeFor; uma
// rede sem botão nunca recebe o botão; "sabe ler origem" é usado por quem
// monta a lista de origens (não testado aqui — é decisão de tela, não de
// degradeFor), mas a CAPACIDADE em si é o que decide, e é isso que este
// teste comprova com capabilities arbitrárias (nenhum `if` para uma rede
// nomeada).

const FAKE_CAPS_NO_BUTTON_REQUIRES_IMAGE = Object.freeze({
  acceptsButton: false,
  acceptsImage: true,
  requiresImage: true,
  acceptsWatermark: true,
  canReadSource: false,
})

const FAKE_CAPS_TEXT_ONLY = Object.freeze({
  acceptsButton: false,
  acceptsImage: false,
  requiresImage: false,
  acceptsWatermark: false,
  canReadSource: true,
})

test('rede que exige imagem: oferta sem foto fica marcada (sem_imagem_disponivel), decidido só pela declaração', () => {
  const oferta = { texto: 'oi', linkConvertido: 'https://x', imagem: null, produto: { titulo: 't', preco: 100 } }
  const { reducoes } = degradeFor(oferta, FAKE_CAPS_NO_BUTTON_REQUIRES_IMAGE)
  assert.ok(reducoes.includes(DELIVERY_REDUCTION.SEM_IMAGEM_DISPONIVEL))
})

test('rede que exige imagem: oferta COM foto não é marcada', () => {
  const oferta = { texto: 'oi', linkConvertido: 'https://x', imagem: { url: 'https://img' }, produto: { titulo: 't', preco: 100 } }
  const { reducoes } = degradeFor(oferta, FAKE_CAPS_NO_BUTTON_REQUIRES_IMAGE)
  assert.ok(!reducoes.includes(DELIVERY_REDUCTION.SEM_IMAGEM_DISPONIVEL))
})

test('rede sem botão: o botão nunca sai na oferta degradada, e a redução é registrada (nunca silenciosa)', () => {
  const oferta = { texto: 'oi', linkConvertido: 'https://x', imagem: { url: 'https://img' }, produto: { titulo: 't', preco: 100 }, botao: { texto: 'Ver canal' } }
  const { oferta: degradada, reducoes } = degradeFor(oferta, FAKE_CAPS_NO_BUTTON_REQUIRES_IMAGE)
  assert.equal(degradada.botao, undefined)
  assert.ok(reducoes.includes(DELIVERY_REDUCTION.BOTAO_REMOVIDO))
})

test('rede sem imagem: a imagem é removida e a redução registrada', () => {
  const oferta = { texto: 'oi', linkConvertido: 'https://x', imagem: { url: 'https://img' }, produto: { titulo: 't', preco: 100 } }
  const { oferta: degradada, reducoes } = degradeFor(oferta, FAKE_CAPS_TEXT_ONLY)
  assert.equal(degradada.imagem, null)
  assert.ok(reducoes.includes(DELIVERY_REDUCTION.IMAGEM_REMOVIDA))
})

test('rede que aceita tudo: nenhuma redução, oferta sai intacta', () => {
  const oferta = { texto: 'oi', linkConvertido: 'https://x', imagem: { url: 'https://img' }, produto: { titulo: 't', preco: 100 }, botao: { texto: 'Ver canal' }, marca: { texto: 'minha loja' } }
  const capsTudo = { acceptsButton: true, acceptsImage: true, requiresImage: false, acceptsWatermark: true, canReadSource: true }
  const { oferta: degradada, reducoes } = degradeFor(oferta, capsTudo)
  assert.deepEqual(degradada, oferta)
  assert.deepEqual(reducoes, [])
})

test('degradação nunca é silenciosa: toda redução aplicada aparece na lista', () => {
  const oferta = { texto: 'oi', linkConvertido: 'https://x', imagem: { url: 'https://img' }, produto: { titulo: 't', preco: 100 }, botao: { texto: 'Ver canal' }, marca: { texto: 'x' } }
  const { reducoes } = degradeFor(oferta, FAKE_CAPS_TEXT_ONLY)
  assert.ok(reducoes.includes(DELIVERY_REDUCTION.BOTAO_REMOVIDO))
  assert.ok(reducoes.includes(DELIVERY_REDUCTION.IMAGEM_REMOVIDA))
  assert.ok(reducoes.includes(DELIVERY_REDUCTION.MARCA_DAGUA_REMOVIDA))
})
