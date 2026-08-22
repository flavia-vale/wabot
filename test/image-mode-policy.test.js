import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { resolveGroupImageMode, DEFAULT_GROUP_IMAGE_MODE } from '../src/core/imageModePolicy.js'

// 2026-08-20: com o Mercado Livre barrando o IP do servidor, parte das ofertas
// voltou a sair sem foto no modo preview. A troca para "imagem que veio na
// mensagem" (`original`) é global e por env — não reescreve escolha no banco e
// volta apagando a linha do `.env`.

// 2026-08-21: o padrão do produto passou a ser "a foto que veio na oferta"
// (`original`) — o card de preview depende de abrir a página da loja, e loja
// bloqueando o servidor deixava a oferta sem foto. `preview` continua no código
// e alcançável por env, só não é mais o padrão nem aparece na tela da cliente.
test('sem env, o padrão é a foto que veio na oferta', () => {
  assert.equal(resolveGroupImageMode({}), 'original')
  assert.equal(DEFAULT_GROUP_IMAGE_MODE, 'original')
})

test('o modo preview continua alcançável (não foi removido do código)', () => {
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'preview' }), 'preview')
})

test('a env troca o modo de todos os grupos de uma vez', () => {
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'original' }), 'original')
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: ' ORIGINAL ' }), 'original')
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'fetch' }), 'fetch')
})

test('valor inválido não deixa o pipeline sem modo', () => {
  // `.env` mal preenchido não pode virar oferta sem imagem nem erro de envio.
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: 'qualquer' }), DEFAULT_GROUP_IMAGE_MODE)
  assert.equal(resolveGroupImageMode({ GROUP_IMAGE_MODE: '' }), DEFAULT_GROUP_IMAGE_MODE)
  assert.equal(resolveGroupImageMode(), DEFAULT_GROUP_IMAGE_MODE)
})

// 2026-08-22: a escolha por grupo voltou à tela, então o chokepoint VOLTA a
// considerar `Group.imageMode`. O que não pode regredir é ele continuar sendo o
// ÚNICO ponto que decide o modo, e fazer isso pela função de precedência (que
// preserva a chave-mestra de rollback) — nunca lendo o campo cru.
test('o chokepoint decide o modo por resolveGroupImageModeFor, não lendo o campo cru', () => {
  const source = readFileSync(new URL('../src/billing/groupEntitlements.js', import.meta.url), 'utf8')
  const fnStart = source.indexOf('function toMonitorGroup(')
  const fnEnd = source.indexOf('function toPostDetail(')
  const fn = source.slice(fnStart, fnEnd)
  assert.match(fn, /imageMode: resolveGroupImageModeFor\(group\)/)
  assert.equal(/imageMode: group\.imageMode/.test(fn), false, 'o campo cru nunca pode ser lido direto — a precedência é da política')
})

// A escolha da cliente vale...
test('o grupo que escolheu ganha o formato que escolheu', async () => {
  const { resolveGroupImageModeFor } = await import('../src/core/imageModePolicy.js')
  assert.equal(resolveGroupImageModeFor({ imageMode: 'preview' }, {}), 'preview')
  assert.equal(resolveGroupImageModeFor({ imageMode: 'original' }, {}), 'original')
  assert.equal(resolveGroupImageModeFor({ imageMode: ' PREVIEW ' }, {}), 'preview')
})

// ...mas quem nunca escolheu segue o padrão global.
test('grupo sem escolha cai no padrão global (env ou padrão do produto)', async () => {
  const { resolveGroupImageModeFor } = await import('../src/core/imageModePolicy.js')
  assert.equal(resolveGroupImageModeFor({}, {}), DEFAULT_GROUP_IMAGE_MODE)
  assert.equal(resolveGroupImageModeFor({ imageMode: null }, {}), DEFAULT_GROUP_IMAGE_MODE)
  assert.equal(resolveGroupImageModeFor({}, { GROUP_IMAGE_MODE: 'preview' }), 'preview')
})

// Valor legado de um modo que a tela NÃO oferece não pode reativar sozinho um
// caminho dormente que ninguém escolheu conscientemente.
test('modo legado fora da tela (fetch/none) cai no padrão global', async () => {
  const { resolveGroupImageModeFor } = await import('../src/core/imageModePolicy.js')
  assert.equal(resolveGroupImageModeFor({ imageMode: 'fetch' }, {}), DEFAULT_GROUP_IMAGE_MODE)
  assert.equal(resolveGroupImageModeFor({ imageMode: 'none' }, {}), DEFAULT_GROUP_IMAGE_MODE)
})

// A lição de 2026-08-19/21: quando uma loja bloqueia o caminho da foto, é
// preciso trocar o formato de TODAS as contas em minutos. Com a escolha por
// grupo de volta, essa chave-mestra é o que garante o rollback.
test('a chave-mestra global ignora a escolha de todo mundo', async () => {
  const { resolveGroupImageModeFor } = await import('../src/core/imageModePolicy.js')
  const env = { GROUP_IMAGE_MODE_FORCE: 'original', GROUP_IMAGE_MODE: 'preview' }
  assert.equal(resolveGroupImageModeFor({ imageMode: 'preview' }, env), 'original')
  assert.equal(resolveGroupImageModeFor({}, env), 'original')
  // chave-mestra mal preenchida não pode travar o pipeline
  assert.equal(
    resolveGroupImageModeFor({ imageMode: 'preview' }, { GROUP_IMAGE_MODE_FORCE: 'qualquer' }),
    'preview',
  )
})

// RCA 2026-08-20/21 — "no modo original faltou oferta; com o botão Ver canal
// funciona perfeito". Havia DOIS caminhos para a mesma promessa ("usar a imagem
// que veio na mensagem") e eles não eram equivalentes:
//   - com botão: baixa a mídia da origem e SOBE de novo (o botão só é aceito em
//     corpo de mídia) — o caminho que funciona;
//   - sem botão, modo original: REPASSA o proto já hospedado da origem.
// A cliente viu oferta chegar no grupo com botão e não chegar no gêmeo sem
// botão, com o envio gravado como sucesso (o repasse é aceito pelo Baileys e a
// perda acontece na entrega). Padrão passa a ser um caminho só: reupload.

test('por padrão a foto da mensagem é subida de novo, como no caminho do botão', async () => {
  const { shouldReuploadOriginalMedia } = await import('../src/core/imageModePolicy.js')
  assert.equal(shouldReuploadOriginalMedia({}), true)
  assert.equal(shouldReuploadOriginalMedia(undefined), true)
  assert.equal(shouldReuploadOriginalMedia({ IMAGE_ORIGINAL_STRATEGY: '' }), true)
  assert.equal(shouldReuploadOriginalMedia({ IMAGE_ORIGINAL_STRATEGY: 'reupload' }), true)
})

test('o repasse antigo continua acessível como escape hatch', async () => {
  const { shouldReuploadOriginalMedia } = await import('../src/core/imageModePolicy.js')
  assert.equal(shouldReuploadOriginalMedia({ IMAGE_ORIGINAL_STRATEGY: 'relay' }), false)
  assert.equal(shouldReuploadOriginalMedia({ IMAGE_ORIGINAL_STRATEGY: ' RELAY ' }), false)
})

test('o envio só usa relay quando o escape hatch pede (guarda estrutural)', async () => {
  const { readFileSync } = await import('fs')
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  const linha = src.split('\n').find(l => l.includes('shouldRelayOriginalMediaForImageMode(imageMode)') && l.includes('const original'))
  assert.ok(linha, 'decisão de mídia original não encontrada')
  assert.match(linha, /!shouldReuploadOriginalMedia\(\)/, 'o caminho de repasse precisa continuar condicionado ao escape hatch')
})

// 2026-08-22: a escolha voltou à tela. O que a guarda protege agora é COMO ela
// aparece — a decisão de produto é oferecer só os dois formatos que mudam o que
// a pessoa vê, em linguagem leiga, e nunca expor os modos dormentes.
test('a tela de grupos oferece a escolha do formato, só com os dois modos da tela', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  const semComentarios = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '')
  assert.match(semComentarios, /onUpdate\(g\.id, \{ imageMode:/, 'a tela precisa salvar a escolha de formato')
  assert.match(semComentarios, /value="preview"/, 'o card clicável precisa ser oferecido')
  assert.match(semComentarios, /value="original"/, 'a foto da oferta precisa ser oferecida')
  for (const dormente of ['value="fetch"', 'value="none"']) {
    assert.equal(semComentarios.includes(dormente), false, `modo dormente ${dormente} não pode aparecer na tela`)
  }
  assert.match(semComentarios, /Ver canal/, 'a escolha do botão "Ver canal" continua na tela')
})

// Vocabulário: nome técnico não chega à tela (regra canônica do AGENTS.md). A
// cliente lê o que ACONTECE — "abre a loja" vs. "amplia a foto".
test('a tela explica o formato sem jargão', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  const semComentarios = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '')
  for (const jargao of ['imageMode=', 'card de preview', 'linkPreview', 'thumbnail', 'jpegThumbnail']) {
    assert.equal(new RegExp(jargao, 'i').test(semComentarios.replace(/imageMode: e\.target\.value/g, '')), false, `jargão "${jargao}" não pode chegar à tela`)
  }
  assert.match(semComentarios, /abre a loja/i, 'a tela precisa dizer que o card abre a loja')
})

// O botão "Ver canal" só é aceito em mensagem de mídia. Oferecer o card
// clicável junto com o botão prometeria algo que o WhatsApp derruba.
test('com o botão "Ver canal" ligado, a escolha de formato fica travada', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  assert.match(page, /disabled=\{Boolean\(g\.channelButtonJid\)\}/, 'o seletor precisa ficar desabilitado quando há botão de canal')
})
