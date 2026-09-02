// O bloco de segurança da tela de conexão — e o MESMO texto no e-mail de
// "cadastrou e não conectou".
//
// A regra que este arquivo existe para travar: é PROIBIDO prometer que não
// recebemos as mensagens dela. As mensagens dos grupos chegam ao robô, é assim
// que o espelhamento funciona; o que é verdade é que só os grupos escolhidos
// são usados e o resto é descartado na hora. Prometer o que não se cumpre é
// pior do que o medo que se quer resolver.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  WHATSAPP_SAFETY_HEADLINE,
  WHATSAPP_SAFETY_POINTS,
  whatsappSafetyEmailBlock,
} from '../src/domain/painel/whatsappSafety.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const TODOS_OS_TEXTOS = [
  WHATSAPP_SAFETY_HEADLINE,
  ...WHATSAPP_SAFETY_POINTS.flatMap((p) => [p.titulo, p.texto]),
].join(' ').toLowerCase()

test('as quatro garantias cobrem escolha, silêncio, saída e outro número', () => {
  const chaves = WHATSAPP_SAFETY_POINTS.map((p) => p.chave)
  assert.deepEqual(chaves, ['grupos_escolhidos', 'nao_fala_por_voce', 'desconecta_quando_quiser', 'outro_numero'])
  for (const p of WHATSAPP_SAFETY_POINTS) {
    assert.ok(p.titulo.length > 0 && p.texto.length > 0, p.chave)
  }
})

test('NUNCA prometer que não recebemos as mensagens dela', () => {
  const PROMESSAS_FALSAS = [
    'não temos acesso',
    'nao temos acesso',
    'não recebemos suas mensagens',
    'ninguém vê suas mensagens',
    'suas mensagens nunca chegam',
    'não lemos suas mensagens',
  ]
  for (const frase of PROMESSAS_FALSAS) {
    assert.ok(!TODOS_OS_TEXTOS.includes(frase), `promessa que não se cumpre: "${frase}"`)
  }
})

test('diz a verdade que tranquiliza: só os grupos escolhidos, o resto é descartado', () => {
  assert.ok(TODOS_OS_TEXTOS.includes('grupos que você marcar') || TODOS_OS_TEXTOS.includes('grupos que você escolher'))
  assert.ok(TODOS_OS_TEXTOS.includes('descartado'))
  assert.ok(TODOS_OS_TEXTOS.includes('desconecta'))
})

test('sem jargão técnico na tela de conexão', () => {
  for (const termo of ['sessão baileys', 'socket', 'webhook', 'api', 'criptografia de ponta']) {
    assert.ok(!TODOS_OS_TEXTOS.includes(termo), termo)
  }
})

test('o e-mail de "cadastrou e não conectou" usa o MESMO texto da tela', () => {
  const template = getTemplateDefinition('onboarding_conecte_whatsapp')
  const bloco = whatsappSafetyEmailBlock()
  assert.ok(template.body.includes(bloco), 'o e-mail não carrega as mesmas garantias da tela')
  for (const p of WHATSAPP_SAFETY_POINTS) {
    assert.ok(template.body.includes(p.texto), `faltou "${p.chave}" no e-mail`)
  }
})

test('a tela de conexão consome o módulo, não uma cópia do texto', () => {
  const src = readFileSync(new URL('../dashboard/app/painel/whatsapp/page.js', import.meta.url), 'utf8')
  assert.ok(src.includes("from '../../../../src/domain/painel/whatsappSafety.js'"))
  assert.ok(src.includes('WHATSAPP_SAFETY_POINTS.map'))
  // Cópia colada do texto na tela é como as duas pontas passam a divergir.
  for (const p of WHATSAPP_SAFETY_POINTS) {
    assert.ok(!src.includes(p.texto), `texto duplicado na tela: ${p.chave}`)
  }
})
