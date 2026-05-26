import test from 'node:test'
import assert from 'node:assert/strict'
import { createPairingState } from '../src/core/pairingState.js'

test('estado inicial: inativo, sem supressão', () => {
  const s = createPairingState()
  assert.equal(s.isActive(), false)
  assert.equal(s.suppressQrEmission(), false)
  assert.equal(s.suppressAutoRestart(), false)
  assert.equal(s.ownsRequest('any'), false)
})

test('setActive marca ativo e suprime QR + auto-restart', () => {
  const s = createPairingState({ windowMs: 60_000 })
  s.setActive({ phone: '5511988887777', requestId: 'req-1', onExpire: () => {} })
  assert.equal(s.isActive(), true)
  assert.equal(s.suppressQrEmission(), true)
  assert.equal(s.suppressAutoRestart(), true)
  assert.equal(s.ownsRequest('req-1'), true)
  assert.equal(s.ownsRequest('outro'), false)
  const snap = s.snapshot()
  assert.equal(snap.phone, '5511988887777')
  assert.equal(snap.code, null)
})

test('setActive exige phone e requestId', () => {
  const s = createPairingState()
  assert.throws(() => s.setActive({ phone: '', requestId: 'x', onExpire: () => {} }), /obrigatórios/)
  assert.throws(() => s.setActive({ phone: '551199', requestId: '', onExpire: () => {} }), /obrigatórios/)
})

test('clear desativa e libera supressões', () => {
  const s = createPairingState()
  s.setActive({ phone: '551199', requestId: 'r1', onExpire: () => {} })
  s.clear()
  assert.equal(s.isActive(), false)
  assert.equal(s.suppressQrEmission(), false)
  assert.equal(s.suppressAutoRestart(), false)
  assert.equal(s.ownsRequest('r1'), false)
})

test('markCode preenche código sem desativar (UI fica esperando user digitar)', () => {
  const s = createPairingState()
  s.setActive({ phone: '551199', requestId: 'r1', onExpire: () => {} })
  assert.equal(s.markCode('ABCD1234'), true)
  assert.equal(s.isActive(), true)
  assert.equal(s.snapshot().code, 'ABCD1234')
})

test('markCode em estado inativo retorna false (não vaza estado)', () => {
  const s = createPairingState()
  assert.equal(s.markCode('XYZ'), false)
})

test('setActive duas vezes substitui requisição anterior (não acumula)', () => {
  const s = createPairingState()
  s.setActive({ phone: '551111', requestId: 'old', onExpire: () => {} })
  s.setActive({ phone: '551122', requestId: 'new', onExpire: () => {} })
  assert.equal(s.ownsRequest('old'), false)
  assert.equal(s.ownsRequest('new'), true)
  assert.equal(s.snapshot().phone, '551122')
})

test('expiry dispara onExpire e limpa estado se código nunca chegou', async () => {
  const s = createPairingState({ windowMs: 30 })
  let expired = null
  s.setActive({ phone: '551199', requestId: 'rEXP', onExpire: (snap) => { expired = snap } })
  await new Promise(r => setTimeout(r, 60))
  assert.ok(expired, 'onExpire deveria ter disparado')
  assert.equal(expired.requestId, 'rEXP')
  assert.equal(s.isActive(), false)
})

test('expiry NÃO dispara se código foi marcado a tempo', async () => {
  const s = createPairingState({ windowMs: 30 })
  let expired = false
  s.setActive({ phone: '551199', requestId: 'rOK', onExpire: () => { expired = true } })
  s.markCode('FAST123')
  await new Promise(r => setTimeout(r, 60))
  assert.equal(expired, false, 'onExpire não deveria disparar quando código já chegou')
  // estado permanece ativo (worker só limpa em connection.open ou falha real)
  assert.equal(s.isActive(), true)
  assert.equal(s.snapshot().code, 'FAST123')
})

test('clear cancela o expiry timer (não dispara onExpire após clear)', async () => {
  const s = createPairingState({ windowMs: 30 })
  let fired = false
  s.setActive({ phone: '551199', requestId: 'rCLR', onExpire: () => { fired = true } })
  s.clear()
  await new Promise(r => setTimeout(r, 60))
  assert.equal(fired, false)
})

test('setActive subsequente cancela expiry da requisição anterior', async () => {
  const s = createPairingState({ windowMs: 30 })
  let oldExpired = false
  s.setActive({ phone: '551111', requestId: 'old', onExpire: () => { oldExpired = true } })
  // Substitui antes do timer expirar
  await new Promise(r => setTimeout(r, 10))
  s.setActive({ phone: '551122', requestId: 'new', onExpire: () => {} })
  await new Promise(r => setTimeout(r, 40))
  assert.equal(oldExpired, false, 'onExpire da requisição antiga não deve disparar')
})

test('ownsRequest é falso após clear mesmo com requestId que foi ativo', () => {
  const s = createPairingState()
  s.setActive({ phone: '551199', requestId: 'rX', onExpire: () => {} })
  s.clear()
  assert.equal(s.ownsRequest('rX'), false)
})
