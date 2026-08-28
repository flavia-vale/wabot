import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveCapacityEvents } from '../src/ops/capacity/events.js'

test('deriva staging e restart com payload sanitizado e dedupe estável', () => {
  const at = new Date('2026-08-27T12:00:00Z')
  const events = deriveCapacityEvents(
    { stagingOnline: false, uptimeSeconds: 100, components: [{ key: 'api', restartCount: 2 }] },
    { collectedAt: at, stagingOnline: true, uptimeSeconds: 200, components: [{ key: 'api', environment: 'production', restartCount: 3 }] },
  )
  assert.deepEqual(events.map((item) => item.type), ['staging_changed', 'process_restart'])
  assert.equal(events[1].details.restartDelta, 1)
  assert.match(events[1].dedupeKey, /^process_restart:/)
  assert.equal(JSON.stringify(events).includes('token'), false)
})

test('deriva reboot e OOM apenas quando contadores avançam', () => {
  const events = deriveCapacityEvents(
    { uptimeSeconds: 500, oomKillCount: 1, components: [] },
    { collectedAt: new Date('2026-08-27T12:00:00Z'), uptimeSeconds: 5, oomKillCount: 2, components: [] },
  )
  assert.deepEqual(events.map((item) => item.type), ['host_restart', 'oom_kill'])
  assert.equal(events[1].severity, 'critical')
})

test('aceita componentes persistidos como JSON no snapshot anterior', () => {
  const events = deriveCapacityEvents(
    { uptimeSeconds: 10, componentsJson: JSON.stringify([{ key: 'dashboard', restartCount: 4 }]) },
    { collectedAt: new Date('2026-08-27T12:00:00Z'), uptimeSeconds: 20, components: [{ key: 'dashboard', environment: 'production', restartCount: 5 }] },
  )
  assert.equal(events[0].type, 'process_restart')
})

test('anota mudança de política e capacidade persistida sem inferir deploy',()=>{ const events=deriveCapacityEvents({policyVersion:'v1',serverType:'CX33',contractedMemoryMb:8192,components:[]},{collectedAt:new Date('2026-08-27T12:00:00Z'),policyVersion:'v2',serverType:'CX43',contractedMemoryMb:16384,components:[]}); assert.deepEqual(events.map(e=>e.type),['policy_changed','host_capacity_changed']); assert.equal(events.some(e=>e.type.includes('deploy')),false) })

test('anota deploy apenas quando dois markers conclusivos mudam e sanitiza detalhes', () => {
  const events = deriveCapacityEvents(
    { deploymentRevision: '0123456789ab', components: [] },
    { collectedAt: new Date('2026-08-27T12:00:00Z'), deploymentRevision: 'abcdef123456', components: [] },
  )
  assert.deepEqual(events.map((item) => item.type), ['deploy'])
  assert.deepEqual(events[0].details, { revision: 'abcdef123456' })
  assert.equal(JSON.stringify(events[0]).includes('/workspace'), false)
  assert.equal(deriveCapacityEvents({ components: [] }, { deploymentRevision: 'abcdef123456', components: [] }).length, 0)
})
