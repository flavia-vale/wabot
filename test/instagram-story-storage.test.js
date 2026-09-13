import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'

import { cleanupExpiredStoryAssets, createLocalStoryAssetStorage, createStoryAssetStorageFromEnv, renderAndStoreStory } from '../src/instagram/storage/index.js'
import { storyAssetRoutes } from '../src/api/routes/storyAssets.js'

const SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres'

async function makeStorage(now, directory = null) {
  directory ||= await mkdtemp(path.join(os.tmpdir(), 'story-assets-'))
  return createLocalStoryAssetStorage({ directory, publicBaseUrl: 'http://cdn.test/api/public/story-assets', signingSecret: SECRET, now })
}

test('storage grava atomicamente, assina URL e valida acesso sem path traversal', async () => {
  const now = () => Date.parse('2026-09-08T12:00:00Z')
  const storage = await makeStorage(now)
  const saved = await storage.put(Buffer.from('jpeg-falso'), { expiresAt: new Date(now() + 60_000) })
  const url = new URL(storage.signedUrl(saved.storageKey, saved.expiresAt))
  const opened = await storage.openSigned(saved.storageKey, Object.fromEntries(url.searchParams))
  assert.deepEqual(await readFile(opened.file), Buffer.from('jpeg-falso'))
  await assert.rejects(storage.openSigned('../segredo', Object.fromEntries(url.searchParams)), /storageKey/)
  await assert.rejects(storage.openSigned(saved.storageKey, { expires: url.searchParams.get('expires'), signature: '0'.repeat(64) }), /assinatura/)
})

test('configuração por ambiente desliga limpa e falha rápido se ficar parcial', () => {
  assert.equal(createStoryAssetStorageFromEnv({}), null)
  assert.throws(() => createStoryAssetStorageFromEnv({ STORY_ASSET_PUBLIC_BASE_URL: 'http://cdn.test/assets' }), /configurados juntos/)
  assert.throws(() => createStoryAssetStorageFromEnv({ STORY_ASSET_SIGNING_SECRET: SECRET }), /configurados juntos/)
  assert.ok(createStoryAssetStorageFromEnv({ STORY_ASSET_PUBLIC_BASE_URL: 'http://cdn.test/assets', STORY_ASSET_SIGNING_SECRET: SECRET }))
})

test('storage recusa URL expirada e cleanup usa expiração embutida, não mtime', async () => {
  let clock = Date.parse('2026-09-08T12:00:00Z')
  const directory = await mkdtemp(path.join(os.tmpdir(), 'story-assets-'))
  const storage = await makeStorage(() => clock, directory)
  const saved = await storage.put(Buffer.from('x'), { expiresAt: new Date(clock + 1_000) })
  const url = new URL(storage.signedUrl(saved.storageKey, saved.expiresAt))
  await utimes(path.join(directory, saved.storageKey), new Date(clock + 86_400_000), new Date(clock + 86_400_000))
  clock += 2_000
  await assert.rejects(storage.openSigned(saved.storageKey, Object.fromEntries(url.searchParams)), /expirado/)
  assert.deepEqual(await storage.cleanup(), { removed: 1 })
})

test('serviço bloqueia Pro e Trial e persiste asset apenas para Premium', async () => {
  const now = new Date('2026-09-08T12:00:00Z')
  const created = []
  const storage = await makeStorage(() => now.getTime())
  const db = {
    user: { findUnique: async ({ where }) => ({ plan: where.id === 'premium' ? 'premium' : 'pro', accessExpiresAt: null }) },
    renderedAsset: { create: async ({ data }) => { created.push(data); return { id: 'asset-1', ...data } } },
  }
  const renderer = async () => ({ buffer: Buffer.from('jpeg'), mimeType: 'image/jpeg', width: 1080, height: 1920 })
  await assert.rejects(renderAndStoreStory({ userId: 'pro', offer: {}, productImage: Buffer.alloc(1) }, { db, storage, now: () => now, renderer }), error => error.code === 'FEATURE_REQUIRES_PREMIUM')
  const result = await renderAndStoreStory({ userId: 'premium', offer: {}, productImage: Buffer.alloc(1) }, { db, storage, now: () => now, renderer })
  assert.equal(created.length, 1)
  assert.equal(created[0].width, 1080)
  assert.match(result.publicUrl, /signature=/)
})

test('limpeza marca como apagado só depois de remover o arquivo', async () => {
  const updates = []
  const db = {
    renderedAsset: {
      findMany: async () => [{ id: 'a1', storageKey: 'key-1' }, { id: 'a2', storageKey: 'key-2' }],
      updateMany: async args => updates.push(args),
    },
  }
  const storage = { remove: async key => { if (key === 'key-2') throw new Error('disco') } }
  const result = await cleanupExpiredStoryAssets({ db, storage, now: () => new Date('2026-09-08T12:00:00Z') })
  assert.deepEqual(result, { scanned: 2, removed: 1 })
  assert.equal(updates.length, 1)
  assert.equal(updates[0].where.id, 'a1')
})

test('rota pública entrega JPEG assinado e não revela motivo de arquivo inválido', async () => {
  const now = () => Date.parse('2026-09-08T12:00:00Z')
  const storage = await makeStorage(now)
  const saved = await storage.put(Buffer.from('jpeg-falso'), { expiresAt: new Date(now() + 60_000) })
  const signed = new URL(storage.signedUrl(saved.storageKey, saved.expiresAt))
  const app = Fastify()
  await app.register(storyAssetRoutes, { prefix: '/api/public', storage })
  const ok = await app.inject({ method: 'GET', url: `${signed.pathname}${signed.search}` })
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.headers['content-type'], 'image/jpeg')
  assert.equal(ok.headers['x-content-type-options'], 'nosniff')
  assert.deepEqual(ok.rawPayload, Buffer.from('jpeg-falso'))
  const denied = await app.inject({ method: 'GET', url: `${signed.pathname}?expires=${signed.searchParams.get('expires')}&signature=ruim` })
  assert.equal(denied.statusCode, 403)
  assert.deepEqual(denied.json(), { error: 'Imagem indisponível' })
  await app.close()
})
