import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { destinationImageBaseMode, destinationImageUsesWatermark, resolveDestinationImageMode, resolveGroupImageMode, DEFAULT_GROUP_IMAGE_MODE } from '../src/core/imageModePolicy.js'

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

// 2026-08-22 (fim do dia): a escolha por grupo saiu da tela de novo e o
// chokepoint voltou a IGNORAR `Group.imageMode`. Guarda para ninguém reativar o
// campo por engano — o modo é único e vem da env global.
test('a estratégia de imagem sai da origem e passa ao detalhe do destino', () => {
  const source = readFileSync(new URL('../src/billing/groupEntitlements.js', import.meta.url), 'utf8')
  const fnStart = source.indexOf('function toMonitorGroup(')
  const fnEnd = source.indexOf('function toPostDetail(')
  const monitorFn = source.slice(fnStart, fnEnd)
  const postFn = source.slice(fnEnd, source.indexOf('export function buildEntitledGroupConfig'))
  assert.equal(/imageMode/.test(monitorFn), false)
  assert.match(postFn, /imageMode: resolveDestinationImageMode\(group\.imageMode\)/)
})

test('modos compostos resolvem base e uso de marca com fallback seguro', () => {
  assert.equal(resolveDestinationImageMode('original_watermark'), 'original_watermark')
  assert.equal(resolveDestinationImageMode('preview'), 'preview')
  assert.equal(resolveDestinationImageMode('desconhecido'), 'original')
  assert.equal(destinationImageBaseMode('original_watermark'), 'original')
  assert.equal(destinationImageBaseMode('preview_watermark'), 'preview')
  assert.equal(destinationImageUsesWatermark('original_watermark'), true)
  assert.equal(destinationImageUsesWatermark('preview'), false)
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

// A cliente não escolhe formato de imagem: a única escolha de formato na tela é
// o botão "Ver canal". Guarda para o seletor não voltar à UI sem antes fechar a
// investigação de 22/08 (painel mostrava um formato, o grupo recebia outro).
test('a tela oferece o modo de imagem somente nos filtros do destino', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  const semComentarios = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '')
  const monitorStart = semComentarios.indexOf('function MonitorGroupConfig')
  const postStart = semComentarios.indexOf('function renderPostConfig')
  assert.equal(/imageMode/.test(semComentarios.slice(monitorStart, postStart)), false)
  assert.match(semComentarios.slice(postStart), /original_watermark/)
  assert.match(semComentarios.slice(postStart), /Preview clicável/)
  assert.match(semComentarios.slice(postStart), /preview_watermark.*disabled/)
  assert.match(semComentarios, /Ver canal/, 'a escolha do botão "Ver canal" continua na tela')
})
