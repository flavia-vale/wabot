import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeLinkOccupancy, linkGrowthPerHour, pickWorstLink } from '../../src/core/smartLinkOccupancy.js'

const g = (size, extra = {}) => ({ size, enabled: true, hasInvite: true, measurable: true, ...extra })

test('3 grupos de 1000, todos acima de 90% = crítico, média e vagas corretas', () => {
  const r = summarizeLinkOccupancy([g(950), g(920), g(990)], { cap: 1000, growthPerHour: 10 })
  assert.equal(r.level, 'critical')
  assert.equal(r.avgPct, 95)
  assert.equal(r.above90Count, 3)
  assert.equal(r.remainingSlots, 140)
  assert.equal(r.etaHours, 14)
  assert.equal(r.allFull, false)
})

test('média esconde o problema, por isso "warn" quando só parte passa de 90%', () => {
  const r = summarizeLinkOccupancy([g(950), g(950), g(500)], { cap: 1000 })
  assert.equal(r.level, 'warn')
  assert.equal(r.avgPct, 80)
  assert.equal(r.above90Count, 2)
})

test('exatamente 90% já conta (>=)', () => {
  assert.equal(summarizeLinkOccupancy([g(900)], { cap: 1000 }).level, 'critical')
  assert.equal(summarizeLinkOccupancy([g(899)], { cap: 1000 }).level, 'ok')
})

test('grupo pausado, sem convite ou sem medida recente não conta como capacidade', () => {
  const r = summarizeLinkOccupancy([g(950), g(100, { enabled: false }), g(100, { hasInvite: false })], { cap: 1000 })
  assert.equal(r.level, 'critical')
  assert.equal(r.activeCount, 1)
})

test('grupo ATIVO sem medida impede o "crítico" (pode ter vaga de sobra) — nunca alarma no escuro', () => {
  const r = summarizeLinkOccupancy([g(980), g(null, { measurable: false })], { cap: 1000 })
  assert.equal(r.level, 'warn')
})

test('nada medido = nodata, sem número inventado', () => {
  for (const groups of [[], [g(null, { measurable: false })], [g(10, { enabled: false })]]) {
    const r = summarizeLinkOccupancy(groups, { cap: 1000 })
    assert.equal(r.level, 'nodata')
    assert.equal(r.avgPct, null)
    assert.equal(r.remainingSlots, null)
  }
  assert.equal(summarizeLinkOccupancy([g(5)], { cap: 0 }).level, 'nodata')
})

test('lotado: allFull, vagas 0, sem ETA positivo', () => {
  const r = summarizeLinkOccupancy([g(1000), g(1000)], { cap: 1000, growthPerHour: 5 })
  assert.equal(r.allFull, true)
  assert.equal(r.remainingSlots, 0)
  assert.equal(r.level, 'critical')
})

test('acima do teto (1010/1000) não gera vaga negativa', () => {
  assert.equal(summarizeLinkOccupancy([g(1010)], { cap: 1000 }).remainingSlots, 0)
})

test('ETA só existe com crescimento positivo', () => {
  assert.equal(summarizeLinkOccupancy([g(500)], { cap: 1000, growthPerHour: 0 }).etaHours, null)
  assert.equal(summarizeLinkOccupancy([g(500)], { cap: 1000, growthPerHour: -3 }).etaHours, null)
  assert.equal(summarizeLinkOccupancy([g(500)], { cap: 1000, growthPerHour: null }).etaHours, null)
})

test('crescimento: usa 7d se todos têm; senão 24h; senão null (nunca extrapola)', () => {
  const full = { delta7d: { diff: 168 }, delta24h: { diff: 24 } }
  assert.equal(linkGrowthPerHour([full, full]), 2)
  assert.equal(linkGrowthPerHour([full, { delta7d: null, delta24h: { diff: 48 } }]), (24 + 48) / 24)
  assert.equal(linkGrowthPerHour([full, { delta7d: null, delta24h: null }]), null)
  assert.equal(linkGrowthPerHour([]), null)
})

test('link pior: crítico vence aviso vence ok; empate pela maior ocupação', () => {
  const a = { id: 'a', level: 'ok', avgPct: 99 }
  const b = { id: 'b', level: 'critical', avgPct: 91 }
  const c = { id: 'c', level: 'critical', avgPct: 97 }
  assert.equal(pickWorstLink([a, b, c]).id, 'c')
  assert.equal(pickWorstLink([]), null)
})

import { isHotLink } from '../../src/core/smartLinkOccupancy.js'

test('link quente: algum grupo ativo e medido com >= 80% da capacidade', () => {
  assert.equal(isHotLink([g(800)], 1000), true)
  assert.equal(isHotLink([g(799), g(100)], 1000), false)
  assert.equal(isHotLink([g(950, { enabled: false })], 1000), false)
  assert.equal(isHotLink([g(950, { measurable: false })], 1000), false)
  assert.equal(isHotLink([g(950)], 0), false)
  assert.equal(isHotLink([], 1000), false)
})
