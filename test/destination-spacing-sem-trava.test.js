import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  decideDestinationSpacing,
  reserveSpacingSlot,
} from '../src/core/destinationSpacing.js'

// RCA 2026-10-01 "só um grupo de destino recebe as ofertas": com 12 destinos e
// intervalo de 30s, o destino do último envio (isento) furava a fila e os
// outros 11 eram re-adiados para sempre — cada volta encontrava o cursor
// `nextFreeSlotAt` já empurrado pelos jobs adiados depois deles. Em produção:
// #17/#18 com 16-19 posts no dia, os outros 10 com 1, 184 jobs presos em
// "Esperando o intervalo entre destinos".
//
// Simula a fila serial do bot-worker (processSendJob + deferSendJob com
// notBefore + senha de vez `spacingTicket`) usando o módulo REAL.

const INTERVAL = 30_000
const DESTS = Array.from({ length: 12 }, (_, i) => `g${17 + i}@g.us`)

function simulate({ durationMs, offerEveryMs, sendCostMs = 0, stall = null }) {
  let state = { lastSendAt: null, lastDestJid: null, nextFreeSlotAt: null }
  let pending = [] // { destJid, notBefore, spacingTicket, seq }
  const sent = [] // { destJid, at }
  let seq = 0
  let busyUntil = 0

  for (let now = 0; now < durationMs; now += 1000) {
    if (now % offerEveryMs === 0) {
      for (const destJid of DESTS) pending.push({ destJid, notBefore: now, seq: seq++ })
    }
    if (stall && now >= stall.from && now < stall.to) continue
    if (now < busyUntil) continue

    // Fila serial: processa os jobs prontos em ordem de notBefore (FIFO no empate).
    const ready = pending.filter((j) => j.notBefore <= now).sort((a, b) => a.notBefore - b.notBefore || a.seq - b.seq)
    pending = pending.filter((j) => j.notBefore > now)
    for (const job of ready) {
      const d = decideDestinationSpacing({
        now, destJid: job.destJid, intervalMs: INTERVAL, state, ticket: job.spacingTicket ?? null,
      })
      if (d.allow) {
        state = reserveSpacingSlot(state, { now, destJid: job.destJid, intervalMs: INTERVAL })
        sent.push({ destJid: job.destJid, at: now })
        busyUntil = now + sendCostMs
        if (sendCostMs > 0) {
          // envio ocupa o consumidor: o resto volta para a fila sem decidir agora
          pending.push(...ready.slice(ready.indexOf(job) + 1))
          break
        }
        continue
      }
      state = reserveSpacingSlot(state, { now, destJid: job.destJid, intervalMs: INTERVAL, deferredUntil: d.deferUntil })
      assert.ok(d.deferUntil > now, 'adiamento precisa ser para o futuro (jobId do BullMQ usa notBefore)')
      pending.push({ ...job, notBefore: d.deferUntil, spacingTicket: d.ticket ?? job.spacingTicket })
    }
  }
  const byDest = Object.fromEntries(DESTS.map((d) => [d, 0]))
  for (const s of sent) byDest[s.destJid]++
  return { sent, byDest, pending }
}

function minGapBetweenDifferentDests(sent) {
  let min = Infinity
  for (let i = 1; i < sent.length; i++) {
    if (sent[i].destJid !== sent[i - 1].destJid) min = Math.min(min, sent[i].at - sent[i - 1].at)
  }
  return min
}

test('12 destinos, intervalo 30s, oferta a cada 6 min: TODOS os destinos recebem (antes só 1 recebia)', () => {
  const { byDest, sent } = simulate({ durationMs: 3_600_000, offerEveryMs: 360_000 })
  for (const d of DESTS) assert.ok(byDest[d] >= 9, `${d} recebeu só ${byDest[d]} de 10 ofertas`)
  assert.ok(minGapBetweenDifferentDests(sent) >= INTERVAL, 'intervalo entre destinos diferentes continua respeitado')
})

test('fila acima da vazão (oferta a cada 2,5 min): ninguém é esquecido — diferença entre o destino que mais e o que menos recebe é no máximo 1', () => {
  const { byDest, sent } = simulate({ durationMs: 3_600_000, offerEveryMs: 150_000 })
  const counts = Object.values(byDest)
  assert.ok(Math.min(...counts) > 0, `destino sem nenhum envio: ${JSON.stringify(byDest)}`)
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `distribuição injusta: ${JSON.stringify(byDest)}`)
  assert.ok(minGapBetweenDifferentDests(sent) >= INTERVAL)
})

test('envio lento (consumidor ocupado 5s por envio): ainda distribui para todos', () => {
  const { byDest } = simulate({ durationMs: 3_600_000, offerEveryMs: 360_000, sendCostMs: 5000 })
  for (const d of DESTS) assert.ok(byDest[d] >= 8, `${d} recebeu só ${byDest[d]}`)
})

test('fila parada 10 min (reconexão): quando volta NÃO dispara tudo de rajada e todos recebem', () => {
  const { byDest, sent } = simulate({ durationMs: 3_600_000, offerEveryMs: 360_000, stall: { from: 600_000, to: 1_200_000 } })
  for (const d of DESTS) assert.ok(byDest[d] >= 8, `${d} recebeu só ${byDest[d]}`)
  assert.ok(minGapBetweenDifferentDests(sent) >= INTERVAL, 'retorno da fila parada não pode virar rajada')
})

test('senha de vez: job que volta na vaga dele sai, mesmo com o cursor já empurrado por jobs adiados depois', () => {
  const state = { lastSendAt: 0, lastDestJid: 'a@g.us', nextFreeSlotAt: 120_000 }
  const d = decideDestinationSpacing({ now: 30_000, destJid: 'b@g.us', intervalMs: INTERVAL, state, ticket: 30_000 })
  assert.equal(d.allow, true)
})

test('senha de vez: se a vaga chegou mas o último envio foi há menos que o intervalo, espera só o intervalo e mantém a senha', () => {
  const state = { lastSendAt: 25_000, lastDestJid: 'a@g.us', nextFreeSlotAt: 120_000 }
  const d = decideDestinationSpacing({ now: 30_000, destJid: 'b@g.us', intervalMs: INTERVAL, state, ticket: 30_000 })
  assert.equal(d.allow, false)
  assert.equal(d.deferUntil, 55_000)
  assert.equal(d.ticket, 30_000)
})

test('destino do último envio NÃO fura a fila quando há outros destinos esperando', () => {
  const state = { lastSendAt: 0, lastDestJid: 'a@g.us', nextFreeSlotAt: 90_000 }
  const d = decideDestinationSpacing({ now: 5_000, destJid: 'a@g.us', intervalMs: INTERVAL, state })
  assert.equal(d.allow, false)
  assert.equal(d.deferUntil, 90_000)
  assert.equal(d.ticket, 90_000)
})

test('destino do último envio continua isento quando ninguém está esperando', () => {
  const state = { lastSendAt: 0, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const d = decideDestinationSpacing({ now: 5_000, destJid: 'a@g.us', intervalMs: INTERVAL, state })
  assert.equal(d.allow, true)
})

test('reserveSpacingSlot: cursor nunca anda para trás', () => {
  const out = reserveSpacingSlot({ lastSendAt: 0, lastDestJid: 'a', nextFreeSlotAt: 200_000 }, { now: 1, destJid: 'b', intervalMs: INTERVAL, deferredUntil: 40_000 })
  assert.equal(out.nextFreeSlotAt, 200_000)
})

test('bot-worker passa a senha (job.spacingTicket) para a decisão e grava a senha no job antes de adiar', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /ticket:\s*job\.spacingTicket \?\? null/)
  const idxTicket = src.indexOf('job.spacingTicket = spacing.ticket')
  const idxDefer = src.indexOf("'Adiado pelo intervalo entre destinos')")
  assert.ok(idxTicket !== -1 && idxDefer !== -1 && idxTicket < idxDefer, 'senha precisa ser gravada no job antes do deferSendJob')
})
