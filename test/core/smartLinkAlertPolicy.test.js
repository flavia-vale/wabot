import test from 'node:test'
import assert from 'node:assert/strict'
import { decideAlert, stateAfterSend, stateAfterRearm, isQuietHour, hourInSaoPaulo, EMPTY_ALERT_STATE, REMINDER_INTERVAL_MS } from '../../src/core/smartLinkAlertPolicy.js'

// 15:00 em Brasília (UTC-3) — fora do horário de silêncio
const DAY = new Date('2026-09-30T18:00:00Z')
const H = 3600_000
const crit = (over = {}) => ({ level: 'critical', allFull: false, minPct: 92, activeCount: 3, ...over })
const open = (over = {}) => ({ kind: 'warn', lastSentAt: new Date(DAY.getTime() - 2 * H), reminders: 0, activeGroups: 3, ...over })

test('horário de Brasília e silêncio de 22h às 8h', () => {
  assert.equal(hourInSaoPaulo(new Date('2026-09-30T18:00:00Z')), 15)
  assert.equal(isQuietHour(new Date('2026-09-30T18:00:00Z')), false)
  assert.equal(isQuietHour(new Date('2026-10-01T01:00:00Z')), true)  // 22h BRT
  assert.equal(isQuietHour(new Date('2026-10-01T10:59:00Z')), true)  // 07:59 BRT
  assert.equal(isQuietHour(new Date('2026-10-01T11:00:00Z')), false) // 08:00 BRT
})

test('todos >= 90%: avisa UMA vez (aviso), não é lembrete', () => {
  const d = decideAlert({ occupancy: crit(), state: EMPTY_ALERT_STATE, now: DAY })
  assert.deepEqual([d.send, d.kind, d.reminder], [true, 'warn', false])
})

test('todos lotados: urgente', () => {
  const d = decideAlert({ occupancy: crit({ allFull: true, minPct: 100 }), state: EMPTY_ALERT_STATE, now: DAY })
  assert.deepEqual([d.send, d.kind], [true, 'urgent'])
})

test('só parte passou de 90% (warn) ou nada medido: não avisa', () => {
  assert.equal(decideAlert({ occupancy: { level: 'warn', allFull: false, minPct: 40, activeCount: 3 }, now: DAY }).send, false)
  assert.equal(decideAlert({ occupancy: { level: 'ok', allFull: false, minPct: 10, activeCount: 3 }, now: DAY }).send, false)
  const nodata = decideAlert({ occupancy: { level: 'nodata', allFull: false, minPct: null, activeCount: 3 }, state: open(), now: DAY })
  assert.deepEqual([nodata.send, nodata.rearm, nodata.reason], [false, false, 'sem_medicao'])
})

test('não repete de hora em hora: aviso já enviado há 2 h fica quieto', () => {
  const d = decideAlert({ occupancy: crit(), state: open(), now: DAY })
  assert.deepEqual([d.send, d.reason], [false, 'ja_avisada'])
})

test('lembrete só depois de 24 h, no máximo 2 por episódio', () => {
  const at = (h, reminders) => decideAlert({ occupancy: crit(), state: open({ lastSentAt: new Date(DAY.getTime() - h * H), reminders }), now: DAY })
  assert.equal(at(23.9, 0).send, false)
  const first = at(24, 0)
  assert.deepEqual([first.send, first.reminder, first.kind], [true, true, 'warn'])
  assert.equal(at(30, 1).send, true)
  const done = at(72, 2)
  assert.deepEqual([done.send, done.reason], [false, 'lembretes_esgotados'])
})

test('escala para urgente mesmo dentro das 24 h, e de madrugada', () => {
  const night = new Date('2026-10-01T04:00:00Z') // 01:00 BRT
  const d = decideAlert({ occupancy: crit({ allFull: true, minPct: 100 }), state: open({ lastSentAt: new Date(night.getTime() - H) }), now: night })
  assert.deepEqual([d.send, d.kind, d.reminder], [true, 'urgent', false])
})

test('aviso e lembrete não saem de madrugada; o urgente sai', () => {
  const night = new Date('2026-10-01T04:00:00Z')
  assert.deepEqual(decideAlert({ occupancy: crit(), state: EMPTY_ALERT_STATE, now: night }).reason, 'horario_de_silencio')
  const remind = decideAlert({ occupancy: crit(), state: open({ lastSentAt: new Date(night.getTime() - 25 * H) }), now: night })
  assert.equal(remind.send, false)
  assert.equal(decideAlert({ occupancy: crit({ allFull: true }), state: EMPTY_ALERT_STATE, now: night }).send, true)
})

test('rearme: só abaixo de 85%; oscilar perto de 90% NÃO gera novo aviso', () => {
  // 89% (nível warn, mínimo 88): histerese, continua episódio → não reenvia
  const flap = decideAlert({ occupancy: { level: 'warn', allFull: false, minPct: 88, activeCount: 3 }, state: open(), now: DAY })
  assert.deepEqual([flap.send, flap.rearm], [false, false])
  // 80%: folga real → rearma (sem enviar)
  const slack = decideAlert({ occupancy: { level: 'ok', allFull: false, minPct: 80, activeCount: 3 }, state: open(), now: DAY })
  assert.deepEqual([slack.send, slack.rearm], [false, true])
})

test('depois de rearmar, voltar a >= 90% avisa de novo (novo episódio)', () => {
  const d = decideAlert({ occupancy: crit({ minPct: 80 }), state: EMPTY_ALERT_STATE, now: DAY })
  assert.equal(d.send, true)
})

test('grupo novo no link rearma e, se ainda assim todos >= 90%, avisa de novo', () => {
  const d = decideAlert({ occupancy: crit({ activeCount: 4 }), state: open({ lastSentAt: new Date(DAY.getTime() - H) }), now: DAY })
  assert.deepEqual([d.send, d.rearm, d.reminder], [true, true, false])
  const added = decideAlert({ occupancy: { level: 'ok', allFull: false, minPct: 5, activeCount: 4 }, state: open(), now: DAY })
  assert.deepEqual([added.send, added.rearm], [false, true])
})

test('estado depois do envio: primeiro envio zera lembretes; lembrete soma; rearme parte do zero', () => {
  const first = decideAlert({ occupancy: crit(), state: EMPTY_ALERT_STATE, now: DAY })
  const s1 = stateAfterSend({ decision: first, state: EMPTY_ALERT_STATE, occupancy: crit(), now: DAY })
  assert.deepEqual([s1.kind, s1.reminders, s1.activeGroups], ['warn', 0, 3])
  const later = new Date(DAY.getTime() + REMINDER_INTERVAL_MS + H)
  const rem = decideAlert({ occupancy: crit(), state: s1, now: later })
  assert.equal(stateAfterSend({ decision: rem, state: s1, occupancy: crit(), now: later }).reminders, 1)
  const re = { send: true, kind: 'warn', reminder: false, rearm: true }
  assert.equal(stateAfterSend({ decision: re, state: { ...s1, reminders: 2 }, occupancy: crit(), now: later }).reminders, 0)
  assert.deepEqual(stateAfterRearm(), EMPTY_ALERT_STATE)
})
