import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import {
  resolveGroupImageMode,
  DEFAULT_GROUP_IMAGE_MODE,
  DESTINATION_IMAGE_MODE,
  resolveDestinationImageMode,
  destinationImageBaseMode,
  destinationImageUsesWatermark,
} from '../src/core/imageModePolicy.js'

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

// 2026-08-28: a escolha de imagem volta à tela, mas por DESTINO — a origem
// nunca leu `imageMode` e continua sem ler. `toMonitorGroup` não pode voltar a
// expor `imageMode` (nem fixo nem vindo do banco); quem carrega modo/marca é
// `toPostDetail`, só para grupos role='post'.
test('a origem (toMonitorGroup) não expõe imageMode nem watermarkText', () => {
  const source = readFileSync(new URL('../src/billing/groupEntitlements.js', import.meta.url), 'utf8')
  const fnStart = source.indexOf('function toMonitorGroup(')
  const fnEnd = source.indexOf('function toPostDetail(')
  const fn = source.slice(fnStart, fnEnd).replace(/\/\/[^\n]*/g, '')
  assert.equal(/imageMode\s*:/.test(fn), false, 'toMonitorGroup não pode ler nem expor imageMode — isso é do destino')
  assert.equal(/watermarkText\s*:/.test(fn), false)
})

test('o destino (toPostDetail) resolve o modo com resolveDestinationImageMode e expõe watermarkText', () => {
  const source = readFileSync(new URL('../src/billing/groupEntitlements.js', import.meta.url), 'utf8')
  const fnStart = source.indexOf('function toPostDetail(')
  const fnEnd = source.indexOf('export function buildEntitledGroupConfig(')
  const fn = source.slice(fnStart, fnEnd)
  assert.match(fn, /imageMode: resolveDestinationImageMode\(group\.imageMode\)/)
  assert.match(fn, /watermarkText: group\.watermarkText/)
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

// 2026-08-28: a escolha de imagem volta à tela do DESTINO (nunca do grupo
// monitorado/origem) — ver renderPostConfig em dashboard/app/painel/grupos/page.js.
test('a escolha de imagem só aparece na configuração do destino (post), nunca na origem (monitor)', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/grupos/page.js', import.meta.url), 'utf8')
  const monitorFnStart = page.indexOf('function MonitorGroupConfig(')
  const monitorFnEnd = page.indexOf('export default function GruposPage(', monitorFnStart + 1)
  assert.notEqual(monitorFnEnd, -1, 'limite de MonitorGroupConfig não encontrado')
  const monitorFn = page.slice(monitorFnStart, monitorFnEnd)
  assert.equal(/imageMode/.test(monitorFn), false, 'a config do grupo monitorado (origem) não pode oferecer escolha de imagem')

  const postFnStart = page.indexOf('function renderPostConfig(')
  assert.notEqual(postFnStart, -1, 'renderPostConfig não encontrada')
  const postFn = page.slice(postFnStart, postFnStart + 4000)
  assert.match(postFn, /imageMode/, 'a config do destino precisa oferecer o modo de imagem')
  assert.match(postFn, /watermarkText/, 'a config do destino precisa oferecer o texto da marca')
  // 2026-08-30: o card com marca d'água saiu do "em breve" — a composição
  // entrou em buildManualLinkPreview (bot-worker.js) e a API passou a aceitar
  // o modo. A opção não pode voltar a aparecer desabilitada na tela.
  assert.match(postFn, /value="preview_watermark"/, 'a tela precisa oferecer o card com marca d\'água')
  assert.doesNotMatch(postFn, /preview_watermark['"]?\s+disabled/, 'o modo já está implementado; não pode voltar a aparecer desabilitado')
})

// resolveDestinationImageMode / destinationImageBaseMode / destinationImageUsesWatermark

test('resolveDestinationImageMode aceita os 4 modos e cai em original para qualquer outro valor', () => {
  assert.equal(resolveDestinationImageMode('original'), DESTINATION_IMAGE_MODE.ORIGINAL)
  assert.equal(resolveDestinationImageMode('original_watermark'), DESTINATION_IMAGE_MODE.ORIGINAL_WATERMARK)
  assert.equal(resolveDestinationImageMode('preview'), DESTINATION_IMAGE_MODE.PREVIEW)
  assert.equal(resolveDestinationImageMode('preview_watermark'), DESTINATION_IMAGE_MODE.PREVIEW_WATERMARK)
  assert.equal(resolveDestinationImageMode(' ORIGINAL_WATERMARK '), DESTINATION_IMAGE_MODE.ORIGINAL_WATERMARK)
  for (const legacy of ['none', 'fetch', null, undefined, '', 'legado-desconhecido']) {
    assert.equal(resolveDestinationImageMode(legacy), DESTINATION_IMAGE_MODE.ORIGINAL, `esperava fallback para original em ${legacy}`)
  }
})

test('destinationImageBaseMode separa o modo-base (de onde vêm os bytes) da marca d\'água', () => {
  assert.equal(destinationImageBaseMode('original'), 'original')
  assert.equal(destinationImageBaseMode('original_watermark'), 'original')
  assert.equal(destinationImageBaseMode('preview'), 'preview')
  assert.equal(destinationImageBaseMode('preview_watermark'), 'preview')
  assert.equal(destinationImageBaseMode('legado-desconhecido'), 'original')
})

test('destinationImageUsesWatermark só é true nas duas variantes com marca', () => {
  assert.equal(destinationImageUsesWatermark('original'), false)
  assert.equal(destinationImageUsesWatermark('preview'), false)
  assert.equal(destinationImageUsesWatermark('original_watermark'), true)
  assert.equal(destinationImageUsesWatermark('preview_watermark'), true)
})
