import test from 'node:test'
import assert from 'node:assert/strict'
import { InstagramPublishingError, createInstagramPublishingClient } from '../src/instagram/publishing/client.js'
import { processInstagramPublication } from '../src/instagram/publishing/processor.js'
import { createInstagramPublishingQueue, INSTAGRAM_DLQ, INSTAGRAM_QUEUE } from '../src/instagram/publishing/queue.js'

function publication(id = 'p1') {
  return { id, userId: `premium-${id}`, status: 'queued', updatedAt: new Date('2026-09-01'), providerContainerId: null, destination: { instagramConnection: { status: 'connected', loginMethod: 'instagram_login', instagramAccountId: 'ig1', encryptedToken: 'token' } }, renderedAsset: { storageKey: 'asset.jpg', expiresAt: new Date('2026-10-01'), deletedAt: null } }
}

function dbFor(row) {
  const publicationUpdates = []; const attemptUpdates = []
  return { publicationUpdates, attemptUpdates, db: {
    user: { findUnique: async () => ({ plan: 'premium', accessExpiresAt: null }) },
    // findFirst: última publicação da conta, usada pela cadência mínima entre
    // Stories. Sem publicação anterior, não há espera.
    storyPublication: { findUnique: async () => row, findFirst: async () => null, updateMany: async () => ({ count: 1 }), update: async args => { publicationUpdates.push(args.data) } },
    storyPublicationAttempt: { count: async () => 0, create: async () => ({ id: 'a1' }), update: async args => { attemptUpdates.push(args.data) } },
  } }
}

const config = { graph: 'https://graph.instagram.com', graphVersion: 'v25.0', loginMethod: 'instagram_login' }

test('cliente publica STORIES sem expor token no corpo de erro', async () => {
  const calls = []
  const client = createInstagramPublishingClient(config, 'segredo', { fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ id: 'c1' }), { status: 200 }) } })
  await client.createContainer('ig1', 'https://cdn.test/a.jpg')
  assert.equal(calls[0].options.body.get('media_type'), 'STORIES')
  assert.equal(calls[0].options.body.get('image_url'), 'https://cdn.test/a.jpg')
})

test('processor cria container, espera e publica persistindo IDs', async () => {
  const state = dbFor(publication('success'))
  const client = { publishingLimit: async () => ({ data: [{ quota_usage: 1, config: { quota_total: 100 } }] }), createContainer: async () => ({ id: 'c1' }), getContainer: async () => ({ status_code: 'FINISHED' }), publish: async () => ({ id: 'm1' }) }
  const result = await processInstagramPublication('success', { db: state.db, storage: { signedUrl: () => 'https://cdn.test/a.jpg' }, config, clientFactory: () => client, now: () => new Date('2026-09-10') })
  assert.deepEqual(result, { published: true, mediaId: 'm1' })
  assert.ok(state.publicationUpdates.some(update => update.providerContainerId === 'c1'))
  assert.ok(state.publicationUpdates.some(update => update.providerMediaId === 'm1' && update.status === 'published'))
})

test('timeout ambíguo de publish exige reconciliação em vez de duplicar', async () => {
  const state = dbFor(publication('ambiguous'))
  const client = { publishingLimit: async () => ({}), createContainer: async () => ({ id: 'c1' }), getContainer: async () => ({ status_code: 'FINISHED' }), publish: async () => { throw new InstagramPublishingError('META_NETWORK_ERROR', 'rede', { retryable: true, ambiguous: true }) } }
  await assert.rejects(processInstagramPublication('ambiguous', { db: state.db, storage: { signedUrl: () => 'https://cdn.test/a.jpg' }, config, clientFactory: () => client, now: () => new Date('2026-09-10') }), error => error.retryable === false)
  assert.ok(state.publicationUpdates.some(update => update.status === 'reconciliation_required'))
  assert.ok(state.attemptUpdates.some(update => update.retryDisposition === 'reconcile'))
})

test('processor persiste falha de validação em vez de deixar publicação queued', async () => {
  const row = publication('disconnected')
  row.destination.instagramConnection.status = 'expired'
  const state = dbFor(row)
  await assert.rejects(processInstagramPublication('disconnected', { db: state.db, storage: {}, config, now: () => new Date('2026-09-10') }), error => error.code === 'CONNECTION_UNAVAILABLE')
  assert.ok(state.publicationUpdates.some(update => update.status === 'failed' && update.lastErrorCode === 'CONNECTION_UNAVAILABLE'))
  assert.ok(state.attemptUpdates.some(update => update.status === 'failed'))
})

test('processor retoma container_processing após reinício sem criar outro container', async () => {
  const row = publication('resume')
  row.status = 'container_processing'
  row.providerContainerId = 'existing-container'
  const state = dbFor(row)
  let created = 0
  const client = { publishingLimit: async () => ({}), createContainer: async () => { created++; return { id: 'new' } }, getContainer: async id => { assert.equal(id, 'existing-container'); return { status_code: 'FINISHED' } }, publish: async () => ({ id: 'm-resumed' }) }
  const result = await processInstagramPublication('resume', { db: state.db, storage: { signedUrl: () => 'https://cdn.test/a.jpg' }, config, clientFactory: () => client, now: () => new Date('2026-09-10') })
  assert.equal(created, 0)
  assert.equal(result.mediaId, 'm-resumed')
})

test('BullMQ recebe somente publicationId, aplica retry e envia falha final à DLQ', async () => {
  const queues = []; const terminal = []; let worker
  class Queue { constructor(name) { this.name = name; this.jobs = []; queues.push(this) } add(name, data, opts) { this.jobs.push({ name, data, opts }); return Promise.resolve() } getJob() { return Promise.resolve(null) } close() {} }
  class Worker { constructor(name, handler) { this.name = name; this.handler = handler; this.listeners = {}; worker = this } on(event, fn) { this.listeners[event] = fn } close() {} }
  class UnrecoverableError extends Error {}
  const runtime = await createInstagramPublishingQueue({ redisUrl: 'redis://test', processor: async () => ({}), onFinalFailure: (id, error) => terminal.push([id, error.message]), bullmqModule: { Queue, Worker, UnrecoverableError } })
  await runtime.enqueue('publication-1')
  assert.equal(queues.find(q => q.name === INSTAGRAM_QUEUE).jobs[0].data.publicationId, 'publication-1')
  assert.equal(queues.find(q => q.name === INSTAGRAM_QUEUE).jobs[0].opts.attempts, 5)
  await worker.listeners.failed({ id: 'j1', data: { publicationId: 'publication-1' }, attemptsMade: 5, opts: { attempts: 5 } }, new Error('fim'))
  assert.equal(queues.find(q => q.name === INSTAGRAM_DLQ).jobs.length, 1)
  const fatal = new Error('permanente'); fatal.code = 'UNRECOVERABLE'
  await worker.listeners.failed({ id: 'j2', data: { publicationId: 'publication-2' }, attemptsMade: 1, opts: { attempts: 5 } }, fatal)
  assert.equal(queues.find(q => q.name === INSTAGRAM_DLQ).jobs.length, 2)
  assert.deepEqual(terminal, [['publication-1', 'fim'], ['publication-2', 'permanente']])
})

test('cadência segura o próximo Story sem gastar tentativa da fila', async () => {
  const { storyPacingDelayMs, META_DEFAULT_QUOTA_TOTAL } = await import('../src/instagram/publishing/processor.js')
  const agora = new Date('2026-09-13T12:00:00Z')
  // Story recém-publicado: o próximo espera o que falta do intervalo.
  assert.equal(storyPacingDelayMs(new Date('2026-09-13T11:59:30Z'), agora, 90_000), 60_000)
  // Passado o intervalo, sai na hora.
  assert.equal(storyPacingDelayMs(new Date('2026-09-13T11:50:00Z'), agora, 90_000), 0)
  // Primeira publicação da conta nunca espera.
  assert.equal(storyPacingDelayMs(null, agora, 90_000), 0)
  // A Meta libera 25 Stories/24h; o default otimista de 100 fazia o pré-check
  // passar e a recusa acontecer só depois do container criado.
  assert.equal(META_DEFAULT_QUOTA_TOTAL, 25)
})
