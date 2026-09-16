import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryPublication, ensureDefaultStoryTemplate } from '../src/instagram/repository.js'

function request(overrides = {}) {
  return { id: 'pub-1', userId: 'u1', contractVersion: 1, destination: { id: 'd1', type: 'instagram_story' }, source: { type: 'manual', id: 'm1' }, offer: { offerKey: 'o1' }, idempotencyKey: 'idem-1', scheduledFor: null, ...overrides }
}

function fakeDb({ owner = 'u1', templateOwner = null, existing = null } = {}) {
  const creates = []
  const tx = {
    destination: { findFirst: async () => owner ? { id: 'd1', userId: owner } : null },
    storyTemplateVersion: { findFirst: async () => ({ id: 'v1', template: { userId: templateOwner, enabled: true } }) },
    storyPublication: { findUnique: async () => existing, create: async ({ data }) => { creates.push(data); return data } },
  }
  return { db: { $transaction: fn => fn(tx) }, creates }
}

test('cria publicação com snapshot e versão imutáveis', async () => {
  const { db, creates } = fakeDb()
  const result = await createStoryPublication({ request: request(), templateId: 't1', templateVersionId: 'v1' }, { db })
  assert.equal(result.destinationId, 'd1')
  assert.deepEqual(JSON.parse(result.offerSnapshotJson), { offerKey: 'o1' })
  assert.equal(creates.length, 1)
})

test('idempotência devolve publicação existente sem novo insert', async () => {
  const previous = { id: 'previous', userId: 'u1', destinationId: 'd1' }
  const { db, creates } = fakeDb({ existing: previous })
  assert.equal(await createStoryPublication({ request: request(), templateId: 't1', templateVersionId: 'v1' }, { db }), previous)
  assert.equal(creates.length, 0)
})

test('idempotência não atravessa tenant nem destino', async () => {
  for (const previous of [{ id: 'foreign', userId: 'u2', destinationId: 'd1' }, { id: 'other-destination', userId: 'u1', destinationId: 'd2' }]) {
    const { db } = fakeDb({ existing: previous })
    await assert.rejects(createStoryPublication({ request: request(), templateId: 't1', templateVersionId: 'v1' }, { db }), error => error.code === 'IDEMPOTENCY_CONFLICT')
  }
})

test('recusa destino de outro tenant e template privado de outro tenant', async () => {
  const missing = fakeDb({ owner: null })
  await assert.rejects(createStoryPublication({ request: request(), templateId: 't1', templateVersionId: 'v1' }, { db: missing.db }), error => error.code === 'DESTINATION_UNAVAILABLE')
  const foreign = fakeDb({ templateOwner: 'u2' })
  await assert.rejects(createStoryPublication({ request: request(), templateId: 't1', templateVersionId: 'v1' }, { db: foreign.db }), error => error.code === 'TEMPLATE_UNAVAILABLE')
})

test('seed do template padrão é versionado e não sobrescreve versão existente', async () => {
  const calls = []
  const tx = {
    storyTemplate: {
      upsert: async args => { calls.push(args); return { id: 't1', currentVersion: 1 } },
      update: async args => args,
    },
    storyTemplateVersion: { upsert: async args => calls.push(args) },
  }
  await ensureDefaultStoryTemplate({ db: { $transaction: fn => fn(tx) } })
  assert.deepEqual(calls[0].where, { scopeKey_key: { scopeKey: 'system', key: 'wabot_classic' } })
  assert.deepEqual(calls[1].update, {})
  assert.match(calls[1].create.contentHash, /^[a-f0-9]{64}$/)
})
