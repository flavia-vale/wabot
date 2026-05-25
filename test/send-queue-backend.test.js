import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveBackendMode,
  createMemorySendBackend,
} from '../src/sendQueueBackend.js'

// BullMQ é opt-in explícito: o payload de envio contém Buffer de imagem,
// que não sobrevive ao JSON.stringify do BullMQ (sai oferta sem imagem).
// Enquanto a build do payload roda no enqueue, default seguro é memory.
test('resolveBackendMode: vazio + REDIS_URL → memory (BullMQ é opt-in)', () => {
  assert.equal(resolveBackendMode({ queueBackendEnv: '', redisUrl: 'redis://x' }), 'memory')
  assert.equal(resolveBackendMode({ queueBackendEnv: undefined, redisUrl: 'redis://x' }), 'memory')
})

test('resolveBackendMode: vazio + sem Redis → memory', () => {
  assert.equal(resolveBackendMode({ queueBackendEnv: '', redisUrl: '' }), 'memory')
  assert.equal(resolveBackendMode({ queueBackendEnv: undefined, redisUrl: undefined }), 'memory')
})

test('resolveBackendMode: bullmq explícito + REDIS_URL → bullmq', () => {
  assert.equal(resolveBackendMode({ queueBackendEnv: 'bullmq', redisUrl: 'redis://x' }), 'bullmq')
})

test('resolveBackendMode: bullmq explícito sem Redis → memory-fallback', () => {
  assert.equal(resolveBackendMode({ queueBackendEnv: 'bullmq', redisUrl: '' }), 'memory-fallback')
})

test('resolveBackendMode: memory explícito sempre vence', () => {
  assert.equal(resolveBackendMode({ queueBackendEnv: 'memory', redisUrl: 'redis://x' }), 'memory')
  assert.equal(resolveBackendMode({ queueBackendEnv: 'MEMORY', redisUrl: 'redis://x' }), 'memory')
})

test('memory backend expõe getDlqSize() retornando 0 (compatibilidade de superfície)', async () => {
  const backend = createMemorySendBackend({
    maxSize: 10,
    onRejected: () => {},
    onDequeued: async () => {},
  })
  assert.equal(typeof backend.getDlqSize, 'function')
  assert.equal(await backend.getDlqSize(), 0)
  await backend.close()
})

test('memory backend processa enqueue normalmente', async () => {
  const processed = []
  const backend = createMemorySendBackend({
    maxSize: 10,
    onRejected: () => {},
    onDequeued: async job => { processed.push(job.id) },
  })
  backend.enqueue({ id: 1 })
  backend.enqueue({ id: 2 })
  // Aguarda processing
  await new Promise(r => setTimeout(r, 10))
  assert.deepEqual(processed, [1, 2])
  await backend.close()
})

test('memory backend rejeita quando atinge maxSize', () => {
  let rejected = 0
  const backend = createMemorySendBackend({
    maxSize: 1,
    onRejected: () => { rejected++ },
    // não chama onDequeued aqui para manter a fila cheia
    onDequeued: () => new Promise(() => {}),
  })
  assert.equal(backend.enqueue({ id: 1 }), true)
  // Segundo enqueue: backend está processando o primeiro (pendente),
  // fila interna está vazia mas pode aceitar até maxSize=1.
  // Como o primeiro foi removido para process(), o segundo entra.
  assert.equal(backend.enqueue({ id: 2 }), true)
  // Terceiro: agora a fila tem 1 e bate maxSize.
  assert.equal(backend.enqueue({ id: 3 }), false)
  assert.equal(rejected, 1)
})
