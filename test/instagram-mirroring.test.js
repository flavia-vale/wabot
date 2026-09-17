import test from 'node:test'
import assert from 'node:assert/strict'
import { captureInstagramMirror, processInstagramMirrorIngress } from '../src/instagram/mirroring/index.js'

test('captura de espelhamento cria outbox por destino somente no Premium', async () => {
  let data
  const db = {
    instagramMirrorDestination: { findMany: async () => [{ destinationId: 'ig1' }, { destinationId: 'ig2' }] },
    instagramStoryIngress: { findFirst: async () => null, create: async args => { (data ||= []).push(args.data); return args.data } },
  }
  const result = await captureInstagramMirror({ user: { id: 'u1', plan: 'premium' }, sourceGroupId: 'g1', sourceMessageKey: 'g1:m1', text: '*Cafeteira elétrica*', primary: { platform: 'shopee', url: 'https://example.com/raw', converted: 'https://example.com/affiliate' }, credentials: {} }, { db, fetchImageUrl: async () => 'https://example.com/image.jpg' })
  assert.equal(result.captured, 2)
  assert.equal(data[0].sourceMessageKey, 'g1:m1')
  assert.equal(JSON.parse(data[0].offerSnapshotJson).productUrl, 'https://example.com/affiliate')
})

test('consumidor do outbox marca processado após aceitar publicação', async () => {
  const changes = []
  const row = { id: 'in1', userId: 'u1', destinationId: 'ig1', sourceMessageKey: 'g:m', offerSnapshotJson: JSON.stringify({ offerKey: 'g:m', title: 'Oferta', productUrl: 'https://example.com/p', imageUrl: 'https://example.com/i.jpg' }), status: 'pending', attemptCount: 0 }
  const db = {
    instagramStoryIngress: { findMany: async () => [row], updateMany: async () => ({ count: 1 }), update: async args => changes.push(args) },
  }
  const runtime = { db: {}, storage: {}, publishingQueue: {} }
  const accepted = []
  // `enrich` injetado: o consumidor completa título/preço pela loja, e o teste
  // não pode depender de rede.
  const result = await processInstagramMirrorIngress({ db, runtime, enrich: async offer => offer, storyCreator: async input => accepted.push(input), now: () => new Date('2026-09-10T12:00:00Z') })
  assert.equal(result.processed, 1)
  assert.equal(changes[0].data.status, 'processed')
  assert.equal(accepted[0].idempotencyKey, 'mirror:ig1:g:m')
})

test('captura não repete o Story quando a origem reposta a mesma oferta', async () => {
  const criados = []
  const db = {
    instagramMirrorDestination: { findMany: async () => [{ destinationId: 'ig1' }] },
    instagramStoryIngress: {
      // Já existe um ingresso recente para o MESMO produto neste destino.
      findFirst: async () => ({ id: 'anterior' }),
      create: async args => { criados.push(args.data); return args.data },
    },
  }
  const result = await captureInstagramMirror({
    user: { id: 'u1', plan: 'premium' },
    sourceGroupId: 'g1',
    // key.id novo: é assim que um repost da origem chega, e é por isso que o
    // par único (destino, mensagem) não segurava a repetição.
    sourceMessageKey: 'g1:m2',
    text: 'Cafeteira eletrica inox 220v',
    primary: { platform: 'shopee', url: 'https://example.com/raw?utm=1', converted: 'https://example.com/aff' },
  }, { db })
  assert.equal(result.captured, 0)
  assert.equal(result.deduped, 1)
  assert.equal(criados.length, 0)
})

test('título do espelhamento ignora o banner do grupo e não parte emoji', async () => {
  const { titleFromText, productKeyForMirror } = await import('../src/instagram/mirroring/capture.js')
  // 🎁 divide o alto surrogate com 🔥/💥: sem a flag `u` a classe apagava só
  // metade do par e sobrava um caractere solto no título.
  assert.equal(titleFromText('🎁 Brinde surpresa do dia'), 'Brinde surpresa do dia')
  assert.ok(!/[\uD800-\uDFFF]/.test(titleFromText('🛒 Carrinho cheio de ofertas')))
  // A primeira linha costuma ser o banner do grupo, não o produto.
  assert.equal(titleFromText('🔥 OFERTA\nCooktop Electrolux 5 bocas vidro\nDe 399 por 199'), 'Cooktop Electrolux 5 bocas vidro')
  // Mesmo produto com rastreio diferente é a MESMA chave de dedup.
  assert.equal(productKeyForMirror({ url: 'https://s.shopee.com.br/ABC?utm=1' }), productKeyForMirror({ url: 'https://s.shopee.com.br/ABC/' }))
})
