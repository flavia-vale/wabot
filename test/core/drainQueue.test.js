import { test } from 'node:test'
import assert from 'node:assert/strict'
import { waitUntilDrained, makeInFlightTracker } from '../../src/core/drainQueue.js'

test('waitUntilDrained retorna drained=true imediatamente quando já está drenado', async () => {
  const start = Date.now()
  const result = await waitUntilDrained({
    isDrained: () => true,
    timeoutMs: 1000,
    pollIntervalMs: 50,
  })
  const elapsed = Date.now() - start
  assert.equal(result.drained, true)
  assert.ok(!result.timedOut, 'não deveria ter timed out')
  assert.ok(elapsed < 50, `deveria retornar quase instantaneamente; demorou ${elapsed}ms`)
})

test('waitUntilDrained retorna drained=true após polling quando isDrained vira true', async () => {
  let calls = 0
  const result = await waitUntilDrained({
    isDrained: () => ++calls >= 4, // true na 4a chamada
    timeoutMs: 1000,
    pollIntervalMs: 20,
  })
  assert.equal(result.drained, true)
  assert.ok(!result.timedOut)
  assert.ok(result.elapsedMs >= 60, `deveria ter esperado ≥ 3 polls de 20ms; elapsed=${result.elapsedMs}ms`)
})

test('waitUntilDrained retorna timedOut=true quando isDrained nunca vira true', async () => {
  const start = Date.now()
  const result = await waitUntilDrained({
    isDrained: () => false,
    timeoutMs: 100,
    pollIntervalMs: 20,
  })
  const elapsed = Date.now() - start
  assert.equal(result.drained, false)
  assert.equal(result.timedOut, true)
  assert.ok(elapsed >= 100, `deveria ter respeitado o timeout de 100ms; elapsed=${elapsed}ms`)
  assert.ok(elapsed < 200, `não deveria exceder muito o timeout; elapsed=${elapsed}ms`)
})

test('waitUntilDrained usa pollIntervalMs default razoável quando não fornecido', async () => {
  // sem pollIntervalMs, deve usar default (50ms) e ainda funcionar
  const result = await waitUntilDrained({
    isDrained: () => true,
    timeoutMs: 1000,
  })
  assert.equal(result.drained, true)
})

test('waitUntilDrained chama isDrained pelo menos uma vez mesmo com timeout=0', async () => {
  let called = 0
  const result = await waitUntilDrained({
    isDrained: () => { called++; return false },
    timeoutMs: 0,
    pollIntervalMs: 10,
  })
  assert.ok(called >= 1, 'isDrained deveria ter sido chamado ao menos uma vez')
  assert.equal(result.timedOut, true)
})

test('waitUntilDrained propaga exceção de isDrained', async () => {
  await assert.rejects(
    waitUntilDrained({
      isDrained: () => { throw new Error('check falhou') },
      timeoutMs: 100,
      pollIntervalMs: 10,
    }),
    /check falhou/,
  )
})

test('makeInFlightTracker começa drenado', () => {
  const tracker = makeInFlightTracker()
  assert.equal(tracker.isDrained(), true)
  assert.equal(tracker.inFlightCount(), 0)
})

test('makeInFlightTracker conta jobs ativos e decrementa ao final', async () => {
  const tracker = makeInFlightTracker()
  let release
  const work = new Promise(resolve => { release = resolve })

  const tracked = tracker.track(() => work)
  assert.equal(tracker.inFlightCount(), 1, 'deveria estar com 1 em vôo')
  assert.equal(tracker.isDrained(), false)

  release('ok')
  const result = await tracked
  assert.equal(result, 'ok', 'deveria retornar o valor da função')
  assert.equal(tracker.inFlightCount(), 0)
  assert.equal(tracker.isDrained(), true)
})

test('makeInFlightTracker decrementa mesmo quando work lança exceção', async () => {
  const tracker = makeInFlightTracker()
  await assert.rejects(
    tracker.track(async () => { throw new Error('boom') }),
    /boom/,
  )
  assert.equal(tracker.inFlightCount(), 0)
  assert.equal(tracker.isDrained(), true)
})

test('makeInFlightTracker conta corretamente com múltiplos jobs paralelos', async () => {
  const tracker = makeInFlightTracker()
  const releases = []
  const works = Array.from({ length: 3 }, () => new Promise(r => releases.push(r)))
  const tracked = works.map(w => tracker.track(() => w))

  assert.equal(tracker.inFlightCount(), 3)
  releases[0]('a')
  await tracked[0]
  assert.equal(tracker.inFlightCount(), 2)
  releases[1]('b')
  releases[2]('c')
  await Promise.all(tracked)
  assert.equal(tracker.inFlightCount(), 0)
})

test('integração: waitUntilDrained termina quando tracker fica vazio', async () => {
  const tracker = makeInFlightTracker()
  let release
  const work = new Promise(r => { release = r })
  const tracked = tracker.track(() => work)

  // Drena em paralelo enquanto o work ainda está em vôo.
  const drainPromise = waitUntilDrained({
    isDrained: tracker.isDrained,
    timeoutMs: 1000,
    pollIntervalMs: 20,
  })

  // Solta o work após 50ms; drainPromise deve concluir logo em seguida.
  setTimeout(() => release('done'), 50)
  await tracked

  const result = await drainPromise
  assert.equal(result.drained, true)
  assert.ok(!result.timedOut)
  assert.ok(result.elapsedMs >= 50 && result.elapsedMs < 200, `elapsed esperado entre 50–200ms; foi ${result.elapsedMs}ms`)
})
