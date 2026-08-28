import test from 'node:test'
import assert from 'node:assert/strict'
import { createMessageQueue } from '../src/messageQueue.js'

const proximoTick = () => new Promise(resolve => setImmediate(resolve))
const espera = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// RCA 2026-08-28 (cynthiatceles@gmail.com, terceira vez): sessão conectada,
// heartbeat verde, mensagens chegando — e nenhuma oferta saindo.
//
// A fila de entrada serializa por `orderKey` (o jid da origem) para não
// espelhar fora de ordem. O elo da corrente era a promessa da tarefa ANTERIOR,
// e ela só resolvia quando a função do job terminava de verdade. Só que o
// timeout da fila NÃO cancela a função: ele libera o slot e segue a vida.
// Resultado: uma única mensagem que trava para sempre (uma chamada de rede sem
// timeout, um IPC sem resposta) deixa a corrente daquele grupo pendurada, e
// TODA mensagem seguinte da mesma origem nunca roda. Fica tudo verde e nada sai.
test('mensagem travada NÃO pode bloquear para sempre as seguintes da mesma origem', async () => {
  const fila = createMessageQueue({
    name: 'teste',
    concurrency: 2,
    taskTimeoutMs: 40,
    watchdogStallMs: 60,
    watchdogIntervalMs: 10,
  })

  const executadas = []
  // Trava de vez: promessa que nunca resolve (é o que acontece com uma chamada
  // de rede sem timeout dentro do processamento da mensagem).
  fila.enqueue(() => new Promise(() => {}), { label: 'travada', orderKey: 'grupo-a' })
  await proximoTick()

  fila.enqueue(async () => { executadas.push('depois-1') }, { label: 'depois-1', orderKey: 'grupo-a' })
  fila.enqueue(async () => { executadas.push('depois-2') }, { label: 'depois-2', orderKey: 'grupo-a' })

  // Tempo de sobra: o timeout da tarefa (40ms) e o watchdog (60ms) já agiram.
  await espera(400)

  assert.deepEqual(executadas, ['depois-1', 'depois-2'], 'a origem ficou surda para sempre por causa de uma mensagem só')
  fila.close()
})

test('outra origem nunca é afetada por uma origem travada', async () => {
  const fila = createMessageQueue({ name: 'teste', concurrency: 2, taskTimeoutMs: 40, watchdogStallMs: 60, watchdogIntervalMs: 10 })
  const executadas = []
  fila.enqueue(() => new Promise(() => {}), { label: 'travada', orderKey: 'grupo-a' })
  await proximoTick()
  fila.enqueue(async () => { executadas.push('grupo-b') }, { label: 'b', orderKey: 'grupo-b' })
  await espera(200)
  assert.deepEqual(executadas, ['grupo-b'])
  fila.close()
})

test('a ordem dentro da mesma origem continua garantida no caminho normal', async () => {
  const fila = createMessageQueue({ name: 'teste', concurrency: 4, taskTimeoutMs: 1_000, watchdogStallMs: 2_000 })
  const ordem = []
  fila.enqueue(async () => { await espera(60); ordem.push('primeira') }, { orderKey: 'g' })
  fila.enqueue(async () => { await espera(10); ordem.push('segunda') }, { orderKey: 'g' })
  fila.enqueue(async () => { ordem.push('terceira') }, { orderKey: 'g' })
  await espera(400)
  assert.deepEqual(ordem, ['primeira', 'segunda', 'terceira'])
  fila.close()
})

test('job que falha não trava a corrente da origem', async () => {
  const fila = createMessageQueue({ name: 'teste', concurrency: 2, taskTimeoutMs: 500, watchdogStallMs: 1_000 })
  const ordem = []
  fila.enqueue(async () => { throw new Error('estourou') }, { orderKey: 'g', onError: async () => {} })
  fila.enqueue(async () => { ordem.push('seguinte') }, { orderKey: 'g' })
  await espera(200)
  assert.deepEqual(ordem, ['seguinte'])
  fila.close()
})
