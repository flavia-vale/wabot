import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { createMemorySendBackend } from '../src/sendQueueBackend.js'
import { calculateProgressiveDelayMs } from '../src/smartDelay.js'
import { DEFAULT_QUEUE_MAX_AGE_MIN, buildQueueExpiredReason, shouldDropExpiredQueueJob } from '../src/core/queueExpiry.js'
import { HARD_DEFAULT_PRESERVATION, resolveDestinationPreservation } from '../src/core/preservationConfig.js'
import { categorizeErrorMsg, ERROR_CATEGORIES } from '../src/errorTaxonomy.js'

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// RCA 2026-07 (produção, conta flavia.vale@usp.br): 489 envios parados na fila e
// mensagem da meia-noite saindo às 14h. Medido: entram ~111/h, saem ~52/h.
// Causa: o freio progressivo anti-ban media a fila TOTAL. Um destino com
// burstCap=1/600s (teto de 6 envios/hora) acumulava centenas de itens e mantinha
// a fila acima do limiar, então TODOS os destinos levavam o atraso máximo (60s)
// em cada envio — inclusive os que têm intervalo mínimo de 3s.

// ---------- B: pressão medida POR DESTINO ----------

test('getQueueSizeByDest conta só o que espera para aquele destino', () => {
  const backend = createMemorySendBackend({ maxSize: 100, onRejected: () => {}, onDequeued: async () => {
    // Segura o consumidor: queremos inspecionar a fila com jobs dentro dela.
    await new Promise(resolve => setTimeout(resolve, 50))
  } })

  backend.enqueue({ logId: '1', destJid: 'lento@g.us' })
  backend.enqueue({ logId: '2', destJid: 'lento@g.us' })
  backend.enqueue({ logId: '3', destJid: 'lento@g.us' })
  backend.enqueue({ logId: '4', destJid: 'rapido@g.us' })

  // O 1º job já saiu da fila para o consumidor; os demais seguem enfileirados.
  assert.equal(backend.getQueueSizeByDest('lento@g.us'), 2)
  assert.equal(backend.getQueueSizeByDest('rapido@g.us'), 1)
  assert.equal(backend.getQueueSizeByDest(null), backend.getQueueSize())
  return backend.close()
})

test('destino entupido não empurra o freio do destino livre', () => {
  const pressure = (size) => calculateProgressiveDelayMs({
    baseDelayMs: 0, queueSize: size, threshold: 20, stepMs: 5_000, maxExtraMs: 60_000,
  })

  // Cenário real: 489 na fila total, ~276 de um destino só.
  assert.equal(pressure(489), 60_000, 'medindo a fila TOTAL o freio satura no teto')
  assert.equal(pressure(276), 60_000, 'o destino entupido continua freado — correto')
  assert.equal(pressure(15), 0, 'o destino livre (15 na fila) não paga freio nenhum')
})

test('bot-worker mede a pressão por destino e recalcula no dequeue', () => {
  assert.match(
    botWorkerSource,
    /function getSendBackendQueueSizeForDest\(destJid\)/,
    'precisa existir a contagem por destino',
  )
  assert.match(
    botWorkerSource,
    /const destQueueSize = getSendBackendQueueSizeForDest\(job\.destJid\)\s*\n\s*const pressureDelayMs = buildQueuePressureDelayMs\(destQueueSize\)/,
    'o freio precisa ser calculado no dequeue, com a fila DAQUELE destino',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /delayMs: buildQueuePressureDelayMs\(\)/,
    'o freio não pode voltar a ser congelado no enqueue com a fila global',
  )
})

// Espera inline de até 90s por min_interval congelava o consumidor serial —
// medido no log: waitMs 87693/89241/89449/89668 num destino com minIntervalSec=100.
test('espera inline de throttle tem teto curto (o resto é re-enfileirado)', () => {
  assert.match(
    botWorkerSource,
    /const THROTTLE_INLINE_WAIT_MAX_MS = Math\.max\(0, envNumber\('THROTTLE_INLINE_WAIT_MAX_MS', 5_000\)\)/,
    'teto inline precisa ser curto para um destino não congelar os outros',
  )
})

// ---------- C: descarte por idade na fila ----------

test('descarta só o que passou do teto do destino', () => {
  const now = Date.parse('2026-07-31T17:00:00Z')
  const h = (n) => now - n * 60 * 60_000

  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: h(6), queueMaxAgeMin: 300, now }).drop, true)
  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: h(4), queueMaxAgeMin: 300, now }).drop, false)
  // Exatamente no limite não descarta (só ACIMA do teto).
  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: h(5), queueMaxAgeMin: 300, now }).drop, false)
})

test('0 desliga o descarte (escape hatch) e sem carimbo de entrada não descarta', () => {
  const now = Date.now()
  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: now - 48 * 60 * 60_000, queueMaxAgeMin: 0, now }).drop, false)
  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: now - 48 * 60 * 60_000, queueMaxAgeMin: null, now }).drop, false)
  // fail-safe: sem enqueuedAt confiável, não joga a oferta fora
  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: null, queueMaxAgeMin: 300, now }).drop, false)
  assert.equal(shouldDropExpiredQueueJob({ enqueuedAt: 0, queueMaxAgeMin: 300, now }).drop, false)
})

test('motivo gravado no MessageLog carrega idade e teto em minutos', () => {
  const reason = buildQueueExpiredReason({ ageMs: 6 * 60 * 60_000, maxAgeMs: 5 * 60 * 60_000 })
  assert.equal(reason, 'skip:queue_expired:age=360min:max=300min')
  assert.equal(categorizeErrorMsg(reason), ERROR_CATEGORIES.CONFIG_BLOCK)
})

test('teto de espera é config de preservação POR DESTINO, com default de 5h', () => {
  assert.equal(DEFAULT_QUEUE_MAX_AGE_MIN, 300)
  assert.equal(HARD_DEFAULT_PRESERVATION.queueMaxAgeMin, 300)

  // override do grupo vence o preset; sem override herda o preset; sem preset cai no default
  assert.equal(resolveDestinationPreservation({ queueMaxAgeMin: 60 }, { preset: { queueMaxAgeMin: 600 } }).queueMaxAgeMin, 60)
  assert.equal(resolveDestinationPreservation({ queueMaxAgeMin: null }, { preset: { queueMaxAgeMin: 600 } }).queueMaxAgeMin, 600)
  assert.equal(resolveDestinationPreservation({}, {}).queueMaxAgeMin, 300)
})

test('bot-worker descarta antes de dormir o freio (não espera 60s pra jogar fora)', () => {
  const dropIdx = botWorkerSource.indexOf('const queueExpiry = shouldDropExpiredQueueJob({')
  const sleepIdx = botWorkerSource.indexOf("}, 'Smart delay antes do envio')")
  assert.ok(dropIdx > 0, 'checagem de idade precisa existir no processSendJob')
  assert.ok(sleepIdx > 0)
  assert.ok(dropIdx < sleepIdx, 'o descarte precisa vir ANTES do smart delay')
  assert.match(botWorkerSource, /status: 'skipped', errorMsg: reason/, 'linha descartada vira skipped com motivo')
})
