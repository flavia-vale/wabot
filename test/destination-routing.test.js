import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DESTINATION_REASON,
  resolveMonitorDestinations,
  shouldDropUnlinkedDestination,
} from '../src/core/destinationRouting.js'

test('escolha explícita da cliente é respeitada', () => {
  const r = resolveMonitorDestinations({
    targetsMode: 'explicit',
    targetPostJids: ['a@g.us', 'b@g.us'],
    allPostJids: ['a@g.us', 'b@g.us', 'c@g.us'],
  })
  assert.deepEqual(r.destinations, ['a@g.us', 'b@g.us'])
  assert.equal(r.reason, DESTINATION_REASON.EXPLICIT)
})

test('escolha explícita que ficou sem destino NÃO vira "todos" (RCA 2026-08-26)', () => {
  const r = resolveMonitorDestinations({
    targetsMode: 'explicit',
    targetPostJids: [],
    allPostJids: ['a@g.us', 'b@g.us', 'c@g.us'],
  })
  assert.deepEqual(r.destinations, [])
  assert.equal(r.reason, DESTINATION_REASON.EXPLICIT_EMPTY)
})

test('origem que nunca escolheu destino mantém o comportamento histórico (todos)', () => {
  const r = resolveMonitorDestinations({
    targetsMode: 'all',
    targetPostJids: [],
    allPostJids: ['a@g.us', 'b@g.us'],
  })
  assert.deepEqual(r.destinations, ['a@g.us', 'b@g.us'])
  assert.equal(r.reason, DESTINATION_REASON.FALLBACK_ALL)
})

test('modo ausente com vínculos usa os vínculos (compatibilidade com dado antigo)', () => {
  const r = resolveMonitorDestinations({
    targetPostJids: ['a@g.us'],
    allPostJids: ['a@g.us', 'b@g.us'],
  })
  assert.deepEqual(r.destinations, ['a@g.us'])
  assert.equal(r.reason, DESTINATION_REASON.EXPLICIT)
})

test('revalidação no dequeue descarta destino desvinculado', () => {
  const v = shouldDropUnlinkedDestination({ destJid: 'x@g.us', currentDestinations: ['a@g.us'] })
  assert.equal(v.drop, true)
  assert.equal(v.reason, 'dest_unlinked')
})

test('revalidação no dequeue deixa passar destino ainda vinculado', () => {
  const v = shouldDropUnlinkedDestination({ destJid: 'a@g.us', currentDestinations: ['a@g.us', 'b@g.us'] })
  assert.equal(v.drop, false)
})

test('sem config confiável o envio segue (fail-safe)', () => {
  const v = shouldDropUnlinkedDestination({ destJid: 'a@g.us', currentDestinations: [], known: false })
  assert.equal(v.drop, false)
  assert.equal(v.reason, 'unknown_config')
})

// Chokepoint: o modo precisa chegar ao worker pela config (buildEntitledGroupConfig).
test('config do worker carrega targetsMode da origem', async () => {
  const { buildEntitledGroupConfig } = await import('../src/billing/groupEntitlements.js')
  const cfg = buildEntitledGroupConfig({
    groups: [
      { id: 'm1', waJid: 'mon@g.us', role: 'monitor', kind: 'group', targetsMode: 'explicit' },
      { id: 'm2', waJid: 'mon2@g.us', role: 'monitor', kind: 'group' },
      { id: 'p1', waJid: 'post@g.us', role: 'post', kind: 'group' },
    ],
    groupTargets: [],
    planSubject: { plan: 'pro' },
  })
  assert.equal(cfg.groups.monitor.find(g => g.waJid === 'mon@g.us').targetsMode, 'explicit')
  assert.equal(cfg.groups.monitor.find(g => g.waJid === 'mon2@g.us').targetsMode, 'all')
})
