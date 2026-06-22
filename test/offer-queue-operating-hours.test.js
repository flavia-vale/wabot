import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOutsideOperatingHours, parseHHMM } from '../src/offerQueue/operatingHours.js'

// Helper: cria um Date cuja hora local em America/Sao_Paulo é a desejada.
// SP é UTC-3 (sem horário de verão desde 2019), então hora local = UTC - 3.
function spDate(hour, minute = 0) {
  return new Date(Date.UTC(2026, 5, 18, (hour + 3) % 24, minute))
}

test('parseHHMM', () => {
  assert.equal(parseHHMM('07:00'), 7 * 60)
  assert.equal(parseHHMM('22:30'), 22 * 60 + 30)
  assert.equal(parseHHMM('00:00'), 0)
  assert.equal(parseHHMM('23:59'), 23 * 60 + 59)
  assert.equal(parseHHMM('24:00'), null)
  assert.equal(parseHHMM('07:60'), null)
  assert.equal(parseHHMM('7:00'), null)
  assert.equal(parseHHMM(''), null)
  assert.equal(parseHHMM(null), null)
})

test('janela normal 07:00-22:00: dentro permite, fora bloqueia', () => {
  assert.equal(isOutsideOperatingHours(spDate(12), '07:00', '22:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(7, 0), '07:00', '22:00'), false) // borda inicial inclusiva
  assert.equal(isOutsideOperatingHours(spDate(21, 59), '07:00', '22:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(22, 0), '07:00', '22:00'), true) // borda final exclusiva
  assert.equal(isOutsideOperatingHours(spDate(6, 59), '07:00', '22:00'), true)
  assert.equal(isOutsideOperatingHours(spDate(2), '07:00', '22:00'), true)
})

test('cruzamento de meia-noite 22:00-06:00', () => {
  assert.equal(isOutsideOperatingHours(spDate(23), '22:00', '06:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(2), '22:00', '06:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(22, 0), '22:00', '06:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(5, 59), '22:00', '06:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(6, 0), '22:00', '06:00'), true) // fim exclusivo
  assert.equal(isOutsideOperatingHours(spDate(12), '22:00', '06:00'), true)
})

test('fail-open: configuração inválida funciona 24h (nunca bloqueia)', () => {
  assert.equal(isOutsideOperatingHours(spDate(3), null, null), false)
  assert.equal(isOutsideOperatingHours(spDate(3), '07:00', null), false)
  assert.equal(isOutsideOperatingHours(spDate(3), 'xx', '22:00'), false)
  assert.equal(isOutsideOperatingHours(spDate(3), '08:00', '08:00'), false) // intervalo degenerado
})
