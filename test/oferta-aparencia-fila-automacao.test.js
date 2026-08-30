import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { drainQueueOnce } from '../src/offerQueue/dispatcher.js'
import { runAutomation } from '../src/offerAutomation/dispatcher.js'
import { resolveOfferAppearance } from '../src/core/imageModePolicy.js'

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// "Como a oferta aparece" deixou de valer só para o espelhamento. A fila
// escolhe por FILA; as ofertas automáticas têm UMA escolha para a conta toda.
// Os dois caminhos saem pelo mesmo lugar (sendBroadcast → receita de imagem no
// worker), então a escolha viaja dentro da receita.

// ---------------------------------------------------------------- fila

function setupFila(queueOverrides = {}) {
  const now = new Date('2026-06-10T15:00:00.000Z')
  const queue = { id: 'q1', userId: 'u1', enabled: true, intervalEnabled: false, hourlyCapEnabled: false, dailyCapEnabled: false, lastSentAt: null, ...queueOverrides }
  const item = { id: 'i1', queueId: 'q1', userId: 'u1', status: 'pending', position: 1, text: 'Oferta', targetJids: '["grupo@g.us"]', imageUrl: 'https://img.test/item.jpg' }
  const calls = { sent: [] }
  const db = {
    offerQueueItem: {
      count: async () => 0,
      findFirst: async () => item,
      updateMany: async () => ({ count: 1 }),
    },
    offerQueue: {
      findFirst: async ({ where, select }) => {
        if (where.enabled === true && queue.enabled !== true) return null
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, queue[k]])) : { ...queue }
      },
      updateMany: () => ({}),
    },
    $transaction: async () => {},
  }
  return { queue, calls, deps: { db, now: () => now, isRunning: () => true, sendBroadcast: async (...args) => { calls.sent.push(args) } } }
}

test('fila sem escolha salva continua saindo como a foto da oferta', async () => {
  const { queue, calls, deps } = setupFila()
  await drainQueueOnce(queue, deps)
  assert.deepEqual(calls.sent[0][3].appearance, { mode: 'original', baseMode: 'original', watermark: null })
})

test('fila leva a própria escolha de aparência para o envio', async () => {
  const { queue, calls, deps } = setupFila({ imageMode: 'preview_watermark', watermarkText: 'Ofertas da Ana', watermarkColor: 'black' })
  await drainQueueOnce(queue, deps)
  const { appearance } = calls.sent[0][3]
  assert.equal(appearance.mode, 'preview_watermark')
  assert.equal(appearance.baseMode, 'preview')
  assert.deepEqual(appearance.watermark, { text: 'Ofertas da Ana', color: 'black' })
})

test('duas filas da mesma conta podem aparecer de formas diferentes', async () => {
  const cartao = setupFila({ id: 'q-card', imageMode: 'preview' })
  await drainQueueOnce(cartao.queue, cartao.deps)
  const foto = setupFila({ id: 'q-foto', imageMode: 'original' })
  await drainQueueOnce(foto.queue, foto.deps)
  assert.equal(cartao.calls.sent[0][3].appearance.baseMode, 'preview')
  assert.equal(foto.calls.sent[0][3].appearance.baseMode, 'original')
})

// ------------------------------------------------- ofertas automáticas

function setupAutomacao(botConfig) {
  const automation = { id: 'a1', userId: 'u1', destGroupJid: 'grupo@g.us', keyword: 'fone', sentItemIds: '[]', page: 1, maxOffersPerRun: 1 }
  const calls = { sent: [] }
  const dbOverride = {
    credential: { findUnique: async () => ({ data: JSON.stringify({ appId: 'x', secretKey: 'y' }) }) },
    botConfig: { findUnique: async () => botConfig },
    offerAutomationSentLog: { findMany: async () => [], createMany: async () => ({}), deleteMany: async () => ({}) },
    offerAutomation: { update: async () => ({}), updateMany: async () => ({}) },
    messageLog: { createMany: async () => ({}), create: async () => ({}) },
  }
  const offers = [{ itemId: '1', shopId: '1', title: 'Fone', price: '99', priceCents: 9900, imageUrl: 'https://img.test/a.jpg', offerLink: 'https://s.shopee.com.br/abc' }]
  return {
    automation,
    calls,
    deps: {
      dbOverride,
      isRunningFn: async () => true,
      fetchOffersFn: async () => ({ offers, rawCount: offers.length }),
      sendBroadcastFn: async (...args) => { calls.sent.push(args) },
    },
  }
}

test('ofertas automáticas usam a escolha ÚNICA da conta, vinda de BotConfig', async () => {
  const { automation, calls, deps } = setupAutomacao({
    automationImageMode: 'original_watermark',
    automationWatermarkText: 'Achadinhos Maria',
    automationWatermarkColor: 'white',
  })
  await runAutomation(automation, deps)
  assert.equal(calls.sent.length, 1)
  const { appearance } = calls.sent[0][3]
  assert.equal(appearance.mode, 'original_watermark')
  assert.deepEqual(appearance.watermark, { text: 'Achadinhos Maria', color: 'white' })
})

test('conta sem escolha salva mantém as ofertas automáticas como a foto da oferta', async () => {
  const { automation, calls, deps } = setupAutomacao({})
  await runAutomation(automation, deps)
  assert.equal(calls.sent[0][3].appearance.mode, 'original')
  assert.equal(calls.sent[0][3].appearance.watermark, null)
})

// A escolha é da CONTA, não da automação: nenhuma coluna de aparência pode
// aparecer em OfferAutomation, senão duas automações da mesma conta
// divergiriam — o oposto do que foi pedido.
test('a aparência das ofertas automáticas não é lida da automação', () => {
  const dispatcher = readFileSync(new URL('../src/offerAutomation/dispatcher.js', import.meta.url), 'utf8')
  assert.doesNotMatch(dispatcher, /automation\.(imageMode|watermarkText|watermarkColor|automationImageMode)/)
  assert.match(dispatcher, /botConfig\?\.automationImageMode/)
})

// ------------------------------------------------------------- worker

test('nenhum dos dois caminhos lê imageMode cru: os dois passam por resolveOfferAppearance', () => {
  for (const arquivo of ['../src/offerQueue/dispatcher.js', '../src/offerAutomation/dispatcher.js']) {
    const src = readFileSync(new URL(arquivo, import.meta.url), 'utf8')
    assert.match(src, /resolveOfferAppearance/, `${arquivo} precisa passar pelo ponto único`)
  }
  assert.match(worker, /const appearance = resolveOfferAppearance\(recipe\.appearance \?\? \{\}\)/)
})

test('a escolha viaja DENTRO da receita, que é o que sobrevive à fila persistida', () => {
  const inicio = worker.indexOf('function buildBroadcastImageRecipe(')
  const fim = worker.indexOf('\n}', inicio)
  assert.match(worker.slice(inicio, fim), /appearance: options\.appearance \?\? undefined/)
})

// Receita enfileirada ANTES desta versão não tem `appearance`. Ela precisa
// continuar saindo exatamente como saía (foto), nunca virar card por acidente.
test('receita antiga, sem escolha, cai em foto da oferta', () => {
  assert.match(worker, /recipe\.appearance \?\? \{\}/)
})

test('o card da oferta exige âncora do link e devolve null sem foto', () => {
  const inicio = worker.indexOf('async function buildBroadcastLinkPreview(')
  assert.notEqual(inicio, -1, 'buildBroadcastLinkPreview não encontrada')
  const fim = worker.indexOf('\nasync function buildPayloadFromRecipe(', inicio)
  const fn = worker.slice(inicio, fim)
  assert.match(fn, /detectLinks\(corpo\)\.find\(l => corpo\.includes\(l\.url\)\)/)
  assert.match(fn, /if \(!link\) return null/)
  assert.match(fn, /if \(!thumb\) return null/)
  // Sem `title` o WhatsApp não renderiza o card (regressão do PR #1186).
  assert.match(fn, /title: storePreviewTitle\(/)
})

// Card impossível (sem link no texto, sem foto) não pode virar texto pelado:
// a oferta continua saindo com foto, só sem o clique que abre a loja.
test('card impossível degrada para a foto, nunca para texto pelado', () => {
  const inicio = worker.indexOf('async function buildPayloadFromRecipe(')
  const fim = worker.indexOf('\n// Resolve qual canal injetar', inicio)
  const fn = worker.slice(inicio, fim === -1 ? inicio + 6000 : fim)
  const preview = fn.indexOf("if (appearance.baseMode === 'preview')")
  const foto = fn.indexOf('let image = null')
  assert.ok(preview !== -1 && foto !== -1 && preview < foto, 'o caminho da foto precisa vir DEPOIS da tentativa de card')
  assert.match(fn, /Cair na FOTO/)
})

test('a marca é composta uma vez só e serve ao card e à foto', () => {
  const inicio = worker.indexOf('async function buildPayloadFromRecipe(')
  const fn = worker.slice(inicio, inicio + 6000)
  assert.equal(fn.split('renderDestinationWatermark(').length - 1, 1, 'a marca não pode ser composta duas vezes por envio')
  assert.match(fn, /jpegThumbnail: marcada\?\.thumbnail/)
  assert.match(fn, /hqBuffer: marcada\?\.main \?\? baixada/)
  // Best-effort: marca que falha deixa a oferta sair sem marca, nunca sem imagem.
  assert.match(fn, /enviando imagem sem marca/)
})

// Ponta a ponta do que o worker de fato recebe: ele resolve DE NOVO o que veio
// na receita (não pode confiar no conteúdo de uma fila persistida). Se a
// segunda resolução não devolvesse a mesma coisa, a escolha da cliente sumiria
// em silêncio entre a tela e o grupo — foi o defeito achado na revisão.
test('a escolha sobrevive à segunda resolução que o worker faz', async () => {
  const { queue, calls, deps } = setupFila({ imageMode: 'preview_watermark', watermarkText: 'Ofertas da Ana', watermarkColor: 'black' })
  await drainQueueOnce(queue, deps)
  const enviada = calls.sent[0][3].appearance
  assert.deepEqual(resolveOfferAppearance(enviada), enviada)
  assert.equal(enviada.baseMode, 'preview')
  assert.equal(enviada.watermark.text, 'Ofertas da Ana')
})

test('a escolha das automáticas também sobrevive à segunda resolução', async () => {
  const { automation, calls, deps } = setupAutomacao({
    automationImageMode: 'original_watermark',
    automationWatermarkText: 'Achadinhos Maria',
    automationWatermarkColor: 'white',
  })
  await runAutomation(automation, deps)
  const enviada = calls.sent[0][3].appearance
  assert.deepEqual(resolveOfferAppearance(enviada), enviada)
})
