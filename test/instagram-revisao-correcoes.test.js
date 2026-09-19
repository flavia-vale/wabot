import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'

import { renderInstagramStory, DEFAULT_STORY_CALL_TO_ACTION, storyCallToAction } from '../src/instagram/rendering/renderer.js'
import { downloadStoryImage } from '../src/instagram/storyDeliveryService.js'
import { isPermanentOAuthFailure } from '../src/instagram/oauth/service.js'
import { friendlyInstagramError, FALLBACK_INSTAGRAM_MESSAGE } from '../src/instagram/errorMessages.js'
import { runInstagramReconciliation } from '../src/instagram/publishing/reconcile.js'
import { priceStringToCents, enrichMirrorOffer } from '../src/instagram/mirroring/offerEnrichment.js'
import { getPlanEntitlements } from '../src/billing/plans.js'
import { anonymizeUser } from '../src/domain/lgpd/dataRequest.js'
import { parseManualPaymentInput } from '../src/domain/payments/manualPayment.js'

const quadrado = () => sharp({ create: { width: 400, height: 400, channels: 3, background: '#dddddd' } }).jpeg().toBuffer()

test('o Story diz a loja e nunca promete clique que a Meta não entrega', async () => {
  // A Content Publishing API publica imagem pura: não existe sticker de link.
  // Sem o nome da loja e sem uma chamada honesta, o Story saía sem nenhuma
  // saída para a pessoa — e o produto inteiro vive de comissão.
  assert.match(DEFAULT_STORY_CALL_TO_ACTION, /bio/i)
  assert.doesNotMatch(DEFAULT_STORY_CALL_TO_ACTION, /arrast[ae]|clique|toque no link|swipe/i)
  assert.equal(storyCallToAction({ callToAction: '  Só hoje  ' }), 'Só hoje')
  assert.equal(storyCallToAction({}), DEFAULT_STORY_CALL_TO_ACTION)
})

test('oferta sem preço não vira buraco branco no card', async () => {
  const semPreco = await renderInstagramStory({ offer: { offerKey: 'k', title: 'Kit body bebê algodão' }, productImage: await quadrado() })
  assert.equal(semPreco.width, 1080)
  assert.equal(semPreco.height, 1920)
})

test('título gigante e palavra sem espaço não estouram o canvas', async () => {
  const titulo = `Cooktop ${'A'.repeat(400)} ${'https://loja.exemplo.com.br/produto/'.repeat(3)}`
  const render = await renderInstagramStory({ offer: { offerKey: 'k', title: titulo, priceCents: 19990 }, productImage: await quadrado() })
  assert.equal(render.width, 1080)
})

test('o download da foto se apresenta como navegador e manda Referer', async () => {
  // CDN de marketplace recusa requisição sem User-Agent de navegador — é a
  // razão pela qual o caminho do WhatsApp já mandava os dois cabeçalhos.
  let recebido = null
  await downloadStoryImage('https://cdn.exemplo.com/p.jpg', {
    refererUrl: 'https://shopee.com.br/produto/1?x=2',
    fetchImpl: async (url, options) => {
      recebido = options
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-length': '3' } })
    },
  })
  assert.match(recebido.headers['User-Agent'], /Mozilla\/5\.0/)
  assert.equal(recebido.headers.Referer, 'https://shopee.com.br/')
})

test('só recusa comprovada da Meta derruba a conexão do Instagram', () => {
  // Antes, QUALQUER exceção sem a flag `retryable` — inclusive um bug nosso —
  // marcava needs_reconnect e desligava os destinos da cliente.
  assert.equal(isPermanentOAuthFailure(new TypeError('bug nosso')), false)
  assert.equal(isPermanentOAuthFailure({ code: 'META_OAUTH_NETWORK', retryable: true }), false)
  assert.equal(isPermanentOAuthFailure({ code: 'META_OAUTH_FAILED', status: 429, retryable: true }), false)
  assert.equal(isPermanentOAuthFailure({ code: 'META_OAUTH_FAILED', status: 503, retryable: true }), false)
  assert.equal(isPermanentOAuthFailure({ code: 'META_OAUTH_FAILED', status: 400 }), true)
  assert.equal(isPermanentOAuthFailure({ code: 'INVALID_CREDENTIAL' }), true)
})

test('erro do Instagram chega à tela em linguagem leiga', () => {
  const frases = ['META_PUBLISH_FAILED', 'PUBLISHING_LIMIT_REACHED', 'CONNECTION_UNAVAILABLE', 'ASSET_UNAVAILABLE', 'IDEMPOTENCY_CONFLICT', 'CONTAINER_ERROR', 'STORY_PACING']
    .map(code => friendlyInstagramError({ code }))
  for (const frase of frases) {
    assert.doesNotMatch(frase, /HTTP \d|container|token|idempot|graph|webhook|payload|OAuth|API/i, `jargão vazou: ${frase}`)
    assert.ok(frase.length > 20)
  }
  assert.equal(friendlyInstagramError({ code: 'CODIGO_QUE_NAO_EXISTE' }), FALLBACK_INSTAGRAM_MESSAGE)
})

test('publicação em conferência é retomada em vez de ficar presa para sempre', async () => {
  // O processor sabe reconciliar (relê o container na Meta); o que faltava era
  // alguém chamá-lo. Sem isso a linha ficava eternamente em "Conferindo".
  const reenfileirados = []
  const db = { storyPublication: { findMany: async args => {
    assert.equal(args.where.status, 'reconciliation_required')
    // Sem container não há o que conferir na Meta.
    assert.deepEqual(args.where.providerContainerId, { not: null })
    return [{ id: 'p1' }, { id: 'p2' }]
  } } }
  const queue = { reenqueue: async id => reenfileirados.push(id) }
  const result = await runInstagramReconciliation({ db, queue, now: () => new Date('2026-09-13T12:00:00Z') })
  assert.deepEqual(result, { scanned: 2, requeued: 2 })
  assert.deepEqual(reenfileirados, ['p1', 'p2'])
})

test('sem fila configurada a conferência não faz nada em vez de estourar', async () => {
  assert.deepEqual(await runInstagramReconciliation({ db: {}, queue: null }), { skipped: 'runtime_unavailable' })
})

test('espelhamento recupera preço da copy do grupo quando a loja não responde', async () => {
  assert.equal(priceStringToCents('R$ 1.299,90'), 129990)
  assert.equal(priceStringToCents('por 199'), 19900)
  assert.equal(priceStringToCents('sem número'), null)
  const enriquecida = await enrichMirrorOffer(
    { offerKey: 'k', title: 'Oferta', productUrl: 'https://exemplo.com/p', attributes: { sourceText: 'Cafeteira\nDe R$ 399,00 por R$ 199,90' } },
    { resolver: async () => null },
  )
  assert.equal(enriquecida.priceCents, 19990)
  assert.equal(enriquecida.oldPriceCents, 39900)
})

test('premium é plano PAGO e alcançável — sem isso o recurso não existe para ninguém', () => {
  const premium = getPlanEntitlements({ plan: 'premium' })
  assert.equal(premium.canUseInstagramStories, true)
  // Premium herda tudo que o Pro tem; senão assinar o plano de cima tiraria
  // filas e automações da cliente.
  assert.equal(premium.canUseOfferQueues, true)
  assert.equal(premium.canUseOfferAutomations, true)
  assert.equal(getPlanEntitlements({ plan: 'pro' }).canUseInstagramStories, false)
  // Liberação manual é hoje o único caminho: não há preço de premium no checkout.
  assert.equal(parseManualPaymentInput({ userId: 'u1', plan: 'premium', days: 30, amount: 99, paymentMethod: 'pix' }).ok, true)
})

test('anonimização apaga o JPEG do Story, não só a linha do banco', async () => {
  // Apagar só a linha deixava a imagem da titular no disco para sempre: a
  // varredura de expirados é guiada pelo banco e nunca mais olhava o arquivo.
  const removidos = []
  const db = {
    user: { findUnique: async () => ({ id: 'u1' }), update: async () => ({}) },
    renderedAsset: { findMany: async () => [{ storageKey: 'a.jpg' }, { storageKey: 'b.jpg' }], deleteMany: async () => ({ count: 2 }) },
  }
  const storage = { remove: async key => { removidos.push(key) } }
  const resumo = await anonymizeUser(db, 'u1', new Date('2026-09-13T00:00:00Z'), { storage })
  assert.deepEqual(removidos, ['a.jpg', 'b.jpg'])
  assert.equal(resumo.purged.renderedAssetFiles, 2)
})
