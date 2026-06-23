import test from 'node:test'
import assert from 'node:assert/strict'

import { seedPreservationPresets } from '../scripts/seed-preservation-presets.mjs'

function makeDb({ users, botConfigs = {}, presets = [], groups = [] }) {
  let presetSeq = 0
  return {
    _presets: presets,
    _groups: groups,
    user: { findMany: async () => users.map((id) => ({ id })) },
    preservationPreset: {
      findFirst: async ({ where }) => presets.find((p) => p.userId === where.userId && p.isDefault === where.isDefault) ?? null,
      create: async ({ data }) => {
        const row = { id: `preset-${++presetSeq}`, ...data }
        presets.push(row)
        return { id: row.id }
      },
    },
    botConfig: { findFirst: async ({ where }) => botConfigs[where.userId] ?? null },
    group: {
      updateMany: async ({ where, data }) => {
        let count = 0
        for (const g of groups) {
          if (g.userId === where.userId && g.role === where.role && g.preservationPresetId == null) {
            g.preservationPresetId = data.preservationPresetId
            count++
          }
        }
        return { count }
      },
    },
  }
}

test('seed: cria preset default a partir da global e atribui aos grupos post', async () => {
  const db = makeDb({
    users: ['u1'],
    botConfigs: {
      u1: { quietHoursEnabled: true, channelQuietHoursJson: '{"startHour":0,"endHour":6,"tz":"America/Sao_Paulo"}', channelThrottleEnabled: true, channelMinIntervalSec: 45, channelBurstCap: 5, channelBurstWindowSec: 300, channelDailyCap: 80 },
    },
    groups: [
      { userId: 'u1', role: 'post', preservationPresetId: null },
      { userId: 'u1', role: 'post', preservationPresetId: null },
      { userId: 'u1', role: 'monitor', preservationPresetId: null }, // não é post → ignora
    ],
  })
  const r = await seedPreservationPresets({ db, now: () => new Date('2026-06-22T00:00:00Z') })
  assert.equal(r.presetsCreated, 1)
  assert.equal(r.groupsAssigned, 2)
  const preset = db._presets[0]
  assert.equal(preset.isDefault, true)
  assert.equal(preset.minIntervalSec, 45)
  assert.equal(preset.dailyCap, 80)
  assert.equal(preset.operatingHoursEnabled, true)
  // quiet {0,6} → funcionamento {6,0}
  assert.deepEqual(JSON.parse(preset.operatingHoursJson), { startHour: 6, endHour: 0, tz: 'America/Sao_Paulo' })
  // grupo monitor não foi tocado
  assert.equal(db._groups.find((g) => g.role === 'monitor').preservationPresetId, null)
})

test('seed: idempotente — não recria preset nem reatribui grupos já vinculados', async () => {
  const db = makeDb({
    users: ['u1'],
    botConfigs: { u1: { quietHoursEnabled: false } },
    presets: [{ id: 'existing', userId: 'u1', isDefault: true }],
    groups: [{ userId: 'u1', role: 'post', preservationPresetId: 'manual-preset' }],
  })
  const r = await seedPreservationPresets({ db })
  assert.equal(r.presetsCreated, 0)
  assert.equal(r.usersSkipped, 1)
  assert.equal(r.groupsAssigned, 0)
  // override do usuário preservado
  assert.equal(db._groups[0].preservationPresetId, 'manual-preset')
})

test('seed: usuário sem BotConfig usa defaults do schema (não quebra)', async () => {
  const db = makeDb({
    users: ['u1'],
    groups: [{ userId: 'u1', role: 'post', preservationPresetId: null }],
  })
  const r = await seedPreservationPresets({ db })
  assert.equal(r.presetsCreated, 1)
  assert.equal(r.groupsAssigned, 1)
  assert.equal(db._presets[0].operatingHoursEnabled, false)
  assert.equal(db._presets[0].minIntervalSec, 30)
})
