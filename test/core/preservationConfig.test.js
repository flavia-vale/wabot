import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveDestinationPreservation,
  quietToOperatingHours,
  HARD_DEFAULT_PRESERVATION,
} from '../../src/core/preservationConfig.js'

const PRESET = {
  operatingHoursEnabled: true,
  operatingHoursJson: '{"startHour":9,"endHour":21,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 45,
  burstCap: 5,
  burstWindowSec: 300,
  dailyCap: 100,
  // Descarte por idade na fila (coluna NOT NULL com default 300): um preset
  // real sempre traz o campo, então o fixture também traz.
  queueMaxAgeMin: 240,
}

test('resolve: sem grupo e sem preset cai no HARD_DEFAULT', () => {
  const r = resolveDestinationPreservation(null)
  assert.deepEqual(r, { ...HARD_DEFAULT_PRESERVATION })
})

test('resolve: preset atribuído sem override do grupo usa o preset inteiro', () => {
  const r = resolveDestinationPreservation({}, { preset: PRESET })
  assert.deepEqual(r, PRESET)
})

test('resolve: override do grupo sobrepõe o preset campo a campo', () => {
  const r = resolveDestinationPreservation(
    { minIntervalSec: 90, dailyCap: 10 },
    { preset: PRESET },
  )
  assert.equal(r.minIntervalSec, 90) // override
  assert.equal(r.dailyCap, 10) // override
  assert.equal(r.burstCap, 5) // do preset
  assert.equal(r.operatingHoursJson, PRESET.operatingHoursJson) // do preset
})

test('resolve: campo null/undefined do grupo NÃO sobrepõe (herda do preset)', () => {
  const r = resolveDestinationPreservation(
    { minIntervalSec: null, burstCap: undefined },
    { preset: PRESET },
  )
  assert.equal(r.minIntervalSec, 45)
  assert.equal(r.burstCap, 5)
})

test('resolve: dailyCap=0 do grupo é override válido (0 ≠ null)', () => {
  const r = resolveDestinationPreservation({ dailyCap: 0 }, { preset: PRESET })
  assert.equal(r.dailyCap, 0)
})

test('resolve: throttleEnabled=false do grupo é override válido (false ≠ null)', () => {
  const r = resolveDestinationPreservation({ throttleEnabled: false }, { preset: PRESET })
  assert.equal(r.throttleEnabled, false)
})

test('resolve: sem preset atribuído cai no defaultPreset da conta', () => {
  const r = resolveDestinationPreservation({ burstCap: 3 }, { defaultPreset: PRESET })
  assert.equal(r.burstCap, 3) // override do grupo
  assert.equal(r.minIntervalSec, 45) // do default
})

test('resolve: preset atribuído tem precedência sobre o defaultPreset', () => {
  const def = { ...PRESET, minIntervalSec: 999 }
  const r = resolveDestinationPreservation({}, { preset: PRESET, defaultPreset: def })
  assert.equal(r.minIntervalSec, 45) // do preset, não do default
})

// ---------- quietToOperatingHours ----------

test('quietToOperatingHours: complemento da janela silenciosa', () => {
  // silêncio 0h–6h → funcionamento 6h–0h
  assert.deepEqual(JSON.parse(quietToOperatingHours('{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}')), {
    startHour: 6, endHour: 0, tz: 'America/Sao_Paulo',
  })
})

test('quietToOperatingHours: janela que cruza meia-noite inverte certo', () => {
  // silêncio 22h–8h → funcionamento 8h–22h
  assert.deepEqual(JSON.parse(quietToOperatingHours('{"startHour":22,"endHour":8,"tz":"America/Sao_Paulo"}')), {
    startHour: 8, endHour: 22, tz: 'America/Sao_Paulo',
  })
})

test('quietToOperatingHours: degenerado {0,0} vira {0,0} (24h)', () => {
  assert.deepEqual(JSON.parse(quietToOperatingHours('{"startHour":0,"endHour":0,"tz":"UTC"}')), {
    startHour: 0, endHour: 0, tz: 'UTC',
  })
})

test('quietToOperatingHours: JSON inválido cai no default e converte', () => {
  // default quiet {0,6} → funcionamento {6,0}
  const r = JSON.parse(quietToOperatingHours('not-json'))
  assert.equal(r.startHour, 6)
  assert.equal(r.endHour, 0)
})

test('quietToOperatingHours: aceita objeto além de string', () => {
  assert.deepEqual(JSON.parse(quietToOperatingHours({ startHour: 1, endHour: 7, tz: 'UTC' })), {
    startHour: 7, endHour: 1, tz: 'UTC',
  })
})
