import test from 'node:test'
import assert from 'node:assert/strict'
import { selectHomeHeroVariant } from '../dashboard/lib/cro-experiments.js'

test('selectHomeHeroVariant honors forced tone', () => {
  const out = selectHomeHeroVariant({ ab_home_hero: 'direto', utm_campaign: 'abc' })
  assert.deepEqual(out, { variant: 'forced-direto', tone: 'direto' })
})

test('selectHomeHeroVariant ignores invalid forced tone and uses campaign seed', () => {
  const out = selectHomeHeroVariant({ ab_home_hero: 'hack', utm_campaign: 'campanha-x' })
  assert.match(out.variant, /^campaign-/)
  assert.ok(['amigavel', 'direto', 'animado'].includes(out.tone))
})

test('selectHomeHeroVariant is deterministic for same seed', () => {
  const a = selectHomeHeroVariant({ utm_campaign: 'same-seed' })
  const b = selectHomeHeroVariant({ utm_campaign: 'same-seed' })
  assert.deepEqual(a, b)
})
