import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PRESERVATION_FEATURE_SELECT, isPreservationActive } from '../src/billing/plans.js'

test('cron de snapshots consulta todos os toggles independentes, não o master legado', () => {
  const source = readFileSync(new URL('../scripts/run_channel_snapshots.mjs', import.meta.url), 'utf8')
  assert.match(source, /select: PRESERVATION_FEATURE_SELECT/)
  assert.doesNotMatch(source, /select:\s*\{\s*preservationEnabled:\s*true\s*\}/)
})

test('qualquer defesa independente permite snapshots para plano elegível', () => {
  for (const key of Object.keys(PRESERVATION_FEATURE_SELECT)) {
    assert.equal(isPreservationActive({ active: true }, { [key]: true }), true, `${key} deve ativar preservação efetiva`)
  }
  assert.equal(isPreservationActive({ active: true }, Object.fromEntries(Object.keys(PRESERVATION_FEATURE_SELECT).map(key => [key, false]))), false)
  assert.equal(isPreservationActive({ active: false }, { channelThrottleEnabled: true }), false)
})
