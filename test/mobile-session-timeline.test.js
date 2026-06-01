import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveTimelineSteps } from '../dashboard/lib/mobileSessionTimeline.js'

test('sem parâmetros: passo 1 active, resto pending', () => {
  const steps = deriveTimelineSteps()
  assert.equal(steps[0].status, 'active')
  assert.equal(steps[1].status, 'pending')
  assert.equal(steps[2].status, 'pending')
  assert.equal(steps[3].status, 'pending')
  assert.equal(steps[4].status, 'pending')
})

test('running=true: passo 1 done, passo 2 active, resto pending', () => {
  const steps = deriveTimelineSteps({ running: true })
  assert.equal(steps[0].status, 'done')
  assert.equal(steps[1].status, 'active')
  assert.equal(steps[2].status, 'pending')
  assert.equal(steps[3].status, 'pending')
  assert.equal(steps[4].status, 'pending')
})

test('running=true e qr disponível: passos 1-2 done, passo 3 active', () => {
  const steps = deriveTimelineSteps({ running: true, qr: 'qr-data-string' })
  assert.equal(steps[0].status, 'done')
  assert.equal(steps[1].status, 'done')
  assert.equal(steps[2].status, 'active')
  assert.equal(steps[3].status, 'pending')
  assert.equal(steps[4].status, 'pending')
})

test('isQrScanned=true: passos 1-3 done, passo 4 active', () => {
  const steps = deriveTimelineSteps({ running: true, isQrScanned: true })
  assert.equal(steps[0].status, 'done')
  assert.equal(steps[1].status, 'done')
  assert.equal(steps[2].status, 'done')
  assert.equal(steps[3].status, 'active')
  assert.equal(steps[4].status, 'pending')
})

test('isConnected=true: todos os passos done', () => {
  const steps = deriveTimelineSteps({ running: true, isConnected: true })
  for (const step of steps) {
    assert.equal(step.status, 'done')
  }
})

test('retorna exatamente 5 passos', () => {
  const steps = deriveTimelineSteps({ running: true, qr: 'data' })
  assert.equal(steps.length, 5)
})

test('passos têm key, label e status', () => {
  const steps = deriveTimelineSteps({ running: true })
  for (const step of steps) {
    assert.ok(step.key)
    assert.ok(step.label)
    assert.ok(['done', 'active', 'pending'].includes(step.status))
  }
})

test('labels são Serviço, QR Code, Lido, Validação, Online', () => {
  const steps = deriveTimelineSteps()
  assert.deepEqual(steps.map((s) => s.label), ['Serviço', 'QR Code', 'Lido', 'Validação', 'Online'])
})
