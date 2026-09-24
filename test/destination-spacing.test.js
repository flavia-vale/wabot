import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DESTINATION_SPACING_REASON,
  isDestinationSpacingEnabled,
  toDestinationIntervalMs,
  decideDestinationSpacing,
  combineGateDecisions,
  reserveSpacingSlot,
} from '../src/core/destinationSpacing.js'

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/destination-spacing.md
// Tabela de verdade mínima (§ do contrato) — FR-022 a FR-026.

test('DESTINATION_SPACING_REASON é o motivo estável esperado', () => {
  assert.equal(DESTINATION_SPACING_REASON, 'destination_spacing')
})

// ---------- isDestinationSpacingEnabled ----------

test('isDestinationSpacingEnabled: ligado por padrão (env ausente)', () => {
  assert.equal(isDestinationSpacingEnabled({}), true)
})

test('isDestinationSpacingEnabled: só "off" exato desliga', () => {
  assert.equal(isDestinationSpacingEnabled({ DESTINATION_SPACING: 'off' }), false)
  assert.equal(isDestinationSpacingEnabled({ DESTINATION_SPACING: '0' }), true)
  assert.equal(isDestinationSpacingEnabled({ DESTINATION_SPACING: 'OFF' }), true)
})

test('isDestinationSpacingEnabled: usa process.env por padrão quando nenhum env é passado', () => {
  assert.equal(isDestinationSpacingEnabled(), true)
})

// ---------- toDestinationIntervalMs ----------

test('toDestinationIntervalMs: lê channelStaggerJitterMs do botConfig', () => {
  assert.equal(toDestinationIntervalMs({ channelStaggerJitterMs: 20000 }), 20000)
})

test('toDestinationIntervalMs: negativo vira 0', () => {
  assert.equal(toDestinationIntervalMs({ channelStaggerJitterMs: -5 }), 0)
})

test('toDestinationIntervalMs: não numérico/ausente vira 0 — NÃO aplica o padrão de 20s (o padrão vem do banco)', () => {
  assert.equal(toDestinationIntervalMs({}), 0)
  assert.equal(toDestinationIntervalMs({ channelStaggerJitterMs: null }), 0)
  assert.equal(toDestinationIntervalMs({ channelStaggerJitterMs: 'abc' }), 0)
  assert.equal(toDestinationIntervalMs(null), 0)
})

test('toDestinationIntervalMs: teto de 600000ms', () => {
  assert.equal(toDestinationIntervalMs({ channelStaggerJitterMs: 999999 }), 600000)
})

test('toDestinationIntervalMs: valor decimal é arredondado para baixo (inteiro)', () => {
  assert.equal(toDestinationIntervalMs({ channelStaggerJitterMs: 1500.7 }), 1500)
})

// ---------- decideDestinationSpacing ----------

const NOW = 1_800_000_000_000
const INTERVAL = 20_000

test('decideDestinationSpacing: primeiro envio do worker (lastSendAt null) libera', () => {
  const d = decideDestinationSpacing({ now: NOW, destJid: 'a@g.us', intervalMs: INTERVAL, state: { lastSendAt: null, lastDestJid: null, nextFreeSlotAt: null } })
  assert.equal(d.allow, true)
})

test('decideDestinationSpacing: grupo A em t0, canal B em t0+5s — defer até t0+intervalo (grupo também espaça)', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const d = decideDestinationSpacing({ now: NOW + 5000, destJid: 'b@newsletter', intervalMs: INTERVAL, state })
  assert.equal(d.allow, false)
  assert.equal(d.deferUntil, NOW + INTERVAL)
  assert.equal(d.reason, 'destination_spacing')
})

test('decideDestinationSpacing: grupo A em t0, grupo B em t0+25s (após o intervalo) — libera', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const d = decideDestinationSpacing({ now: NOW + 25000, destJid: 'b@g.us', intervalMs: INTERVAL, state })
  assert.equal(d.allow, true)
})

test('decideDestinationSpacing: MESMO destino é isento do espaçamento (quem decide é minIntervalSec do destino)', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const d = decideDestinationSpacing({ now: NOW + 5000, destJid: 'a@g.us', intervalMs: INTERVAL, state })
  assert.equal(d.allow, true)
})

test('decideDestinationSpacing: intervalo 0 sempre libera', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const d = decideDestinationSpacing({ now: NOW + 1, destJid: 'b@g.us', intervalMs: 0, state })
  assert.equal(d.allow, true)
})

test('decideDestinationSpacing: enabled=false sempre libera', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const d = decideDestinationSpacing({ now: NOW + 1, destJid: 'b@g.us', intervalMs: INTERVAL, state, enabled: false })
  assert.equal(d.allow, true)
})

test('decideDestinationSpacing: respeita nextFreeSlotAt (cursor de vaga já reservada por outro job adiado)', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: NOW + 40000 }
  const d = decideDestinationSpacing({ now: NOW + 25000, destJid: 'c@g.us', intervalMs: INTERVAL, state })
  assert.equal(d.allow, false)
  assert.equal(d.deferUntil, NOW + 40000)
})

// ---------- combineGateDecisions ----------

test('combineGateDecisions: allow só quando as DUAS decisões liberam', () => {
  assert.equal(combineGateDecisions({ allow: true }, { allow: true }).allow, true)
  assert.equal(combineGateDecisions({ allow: false, deferUntil: 1 }, { allow: true }).allow, false)
  assert.equal(combineGateDecisions({ allow: true }, { allow: false, deferUntil: 1 }).allow, false)
})

test('combineGateDecisions: vale a decisão de MAIOR deferUntil — espaçamento 20s vs. destino 90s → 90s', () => {
  const dest = { allow: false, reason: 'min_interval', deferUntil: NOW + 90000 }
  const spacing = { allow: false, reason: 'destination_spacing', deferUntil: NOW + 20000 }
  const g = combineGateDecisions(dest, spacing)
  assert.equal(g.allow, false)
  assert.equal(g.deferUntil, NOW + 90000)
  assert.equal(g.source, 'destination')
})

test('combineGateDecisions: espaçamento 20s vs. destino 3s → 20s (nunca soma)', () => {
  const dest = { allow: false, reason: 'min_interval', deferUntil: NOW + 3000 }
  const spacing = { allow: false, reason: 'destination_spacing', deferUntil: NOW + 20000 }
  const g = combineGateDecisions(dest, spacing)
  assert.equal(g.allow, false)
  assert.equal(g.deferUntil, NOW + 20000)
  assert.equal(g.source, 'spacing')
  assert.notEqual(g.deferUntil, NOW + 23000, 'nunca soma os dois')
})

test('combineGateDecisions: só o destino pede espera — source "destination"', () => {
  const g = combineGateDecisions({ allow: false, reason: 'burst_cap', deferUntil: NOW + 5000 }, { allow: true })
  assert.equal(g.allow, false)
  assert.equal(g.source, 'destination')
  assert.equal(g.reason, 'burst_cap')
})

test('combineGateDecisions: só o espaçamento pede espera — source "spacing"', () => {
  const g = combineGateDecisions({ allow: true }, { allow: false, reason: 'destination_spacing', deferUntil: NOW + 5000 })
  assert.equal(g.allow, false)
  assert.equal(g.source, 'spacing')
  assert.equal(g.reason, 'destination_spacing')
})

test('combineGateDecisions: as duas liberam — source null', () => {
  const g = combineGateDecisions({ allow: true }, { allow: true })
  assert.equal(g.allow, true)
  assert.equal(g.source, null)
})

// ---------- reserveSpacingSlot ----------

test('reserveSpacingSlot: envio liberado atualiza lastSendAt/lastDestJid e devolve objeto NOVO', () => {
  const state = { lastSendAt: null, lastDestJid: null, nextFreeSlotAt: null }
  const out = reserveSpacingSlot(state, { now: NOW, destJid: 'a@g.us', intervalMs: INTERVAL })
  assert.notEqual(out, state, 'precisa devolver objeto novo (não mutar)')
  assert.equal(state.lastSendAt, null, 'estado original não pode ser mutado')
  assert.equal(out.lastSendAt, NOW)
  assert.equal(out.lastDestJid, 'a@g.us')
})

test('reserveSpacingSlot: job adiado pelo espaçamento atualiza nextFreeSlotAt = deferredUntil + intervalMs', () => {
  const state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }
  const out = reserveSpacingSlot(state, { now: NOW + 1000, destJid: 'b@g.us', intervalMs: INTERVAL, deferredUntil: NOW + 20000 })
  assert.equal(out.nextFreeSlotAt, NOW + 40000)
  // lastSendAt/lastDestJid do envio anterior continuam intocados (o job foi
  // ADIADO, não enviado).
  assert.equal(out.lastSendAt, NOW)
  assert.equal(out.lastDestJid, 'a@g.us')
})

test('cursor de próxima vaga: 3 jobs chegando juntos depois de A recebem vagas em cascata sem re-adiamento N²', () => {
  let state = { lastSendAt: NOW, lastDestJid: 'a@g.us', nextFreeSlotAt: null }

  // B chega logo depois de A — espaçamento nega, vaga marcada em t0+20s.
  const decB = decideDestinationSpacing({ now: NOW + 1, destJid: 'b@g.us', intervalMs: INTERVAL, state })
  assert.equal(decB.allow, false)
  assert.equal(decB.deferUntil, NOW + 20000)
  state = reserveSpacingSlot(state, { now: NOW + 1, destJid: 'b@g.us', intervalMs: INTERVAL, deferredUntil: decB.deferUntil })

  // C chega no mesmo instante — cai atrás de B, vaga em t0+40s (não recalcula do zero contra A).
  const decC = decideDestinationSpacing({ now: NOW + 1, destJid: 'c@g.us', intervalMs: INTERVAL, state })
  assert.equal(decC.allow, false)
  assert.equal(decC.deferUntil, NOW + 40000)
  state = reserveSpacingSlot(state, { now: NOW + 1, destJid: 'c@g.us', intervalMs: INTERVAL, deferredUntil: decC.deferUntil })

  // D chega no mesmo instante — vaga em t0+60s.
  const decD = decideDestinationSpacing({ now: NOW + 1, destJid: 'd@g.us', intervalMs: INTERVAL, state })
  assert.equal(decD.allow, false)
  assert.equal(decD.deferUntil, NOW + 60000)
})
