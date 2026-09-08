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

// --- C1/A3/A4 do plano de ativação de 2026-09-08 -----------------------------

import { buildJustConnectedNextStep } from '../src/credentialBlockAlert/message.js'

const paginaConexao = readFileSync(
  new URL('../dashboard/app/painel/whatsapp/page.js', import.meta.url),
  'utf8',
)

test('A3: as garantias aparecem ANTES do formulário de conexão', () => {
  // É onde a dúvida existe. Depois do formulário elas não respondem nada —
  // quem hesitou já fechou a tela.
  const posGarantias = paginaConexao.indexOf('WHATSAPP_SAFETY_HEADLINE}')
  const posFormulario = paginaConexao.indexOf('Método de conexão')
  assert.ok(posGarantias > 0 && posFormulario > 0)
  assert.ok(posGarantias < posFormulario, 'as garantias caíram para depois do formulário')
})

test('A4: a tela diz o que ela ganha e como sair, acima do botão', () => {
  const posTitulo = paginaConexao.indexOf('Ligue o robô no seu WhatsApp')
  const posAbas = paginaConexao.indexOf('role="tablist"')
  assert.ok(posTitulo > 0, 'sumiu o resultado prometido acima do botão')
  assert.ok(posTitulo < posAbas, 'o resultado ficou abaixo das abas')
  assert.match(paginaConexao, /Você desliga quando quiser/)
})

test('A4: o verbo do botão continua exato — clicar não conecta na hora', () => {
  // Trocar por "Ligar o robô" prometeria conexão imediata; o clique gera um QR
  // ou um código, e a conexão só acontece no celular dela.
  assert.match(paginaConexao, /Gerar QR Code/)
  assert.match(paginaConexao, /Obter código de pareamento/)
})

test('C1: quem conecta sem loja recebe o próximo passo na hora', () => {
  assert.match(paginaConexao, /isConnected && hasAnyCredential === false/)
  assert.match(paginaConexao, /\{nextStep\.ctaLabel\}/)
})

test('C1: carregando ou falha de rede NÃO acusa falta de cadastro', () => {
  // `hasAnyCredential === null` é "não sei ainda". Tratar como "não tem"
  // mandaria refazer um cadastro que já existe.
  assert.ok(
    !/hasAnyCredential !== true/.test(paginaConexao),
    'o cartão passou a aparecer também no estado indeterminado',
  )
})

test('C1: o texto celebra antes de pedir, e explica a recusa', () => {
  const passo = buildJustConnectedNextStep()
  assert.match(passo.headline, /conectado/i)
  assert.ok(/parte mais chata|já passou/i.test(passo.body), 'não reconhece o que ela acabou de vencer')
  assert.ok(/comissão/.test(passo.body), 'não diz por que o robô se recusa a publicar')
  assert.equal(passo.ctaHref, '/painel/ids-afiliada')
})

test('C1: o texto do próximo passo é leigo', () => {
  const passo = buildJustConnectedNextStep()
  const texto = `${passo.headline} ${passo.body} ${passo.ctaLabel} ${passo.hint}`.toLowerCase()
  for (const jargao of ['credential', 'no_valid_conversions', 'cookie', 'ssid', 'api', 'tag=']) {
    assert.ok(!texto.includes(jargao), `"${jargao}" em: ${texto}`)
  }
  // Vocabulário canônico da casa.
  assert.ok(texto.includes('etiqueta de afiliada'))
})

test('C1: o painel expõe o estado das lojas para a tela de conexão', () => {
  const shell = readFileSync(
    new URL('../dashboard/app/painel/PainelShell.js', import.meta.url),
    'utf8',
  )
  // Asserção sobre o CAMPO estar no contexto, não sobre a ordem dos vizinhos:
  // travar a vizinhança quebra quando outro campo entra na lista, sem que nada
  // do comportamento tenha mudado.
  const inicio = shell.indexOf('const ctxValue')
  const ctx = shell.slice(inicio, shell.indexOf(')', shell.indexOf('setHeader', inicio)) + 1)
  assert.match(ctx, /hasAnyCredential/)
  assert.match(ctx, /setHeader/)
})
