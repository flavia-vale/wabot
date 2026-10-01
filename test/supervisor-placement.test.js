import test from 'node:test'
import assert from 'node:assert/strict'
import { findDualOwners, pickNodeForNewSession, resolveSessionNodeId, shouldPlaceSession } from '../src/supervisor/placement.js'

const node = (nodeId, running, { alive = true, max = 20 } = {}) => ({ nodeId, alive, running, max })

test('escolhe o nó vivo com mais vagas livres', () => {
  assert.equal(pickNodeForNewSession({ nodes: [node('n1', 15), node('n2', 5)] }), 'n2')
})

test('empate de vagas: menor nodeId (determinístico)', () => {
  assert.equal(pickNodeForNewSession({ nodes: [node('n2', 10), node('n1', 10)] }), 'n1')
})

test('nó morto nunca é escolhido, mesmo vazio', () => {
  assert.equal(pickNodeForNewSession({ nodes: [node('n1', 19), node('n2', 0, { alive: false })] }), 'n1')
})

test('nó lotado não é escolhido; todos lotados -> null', () => {
  assert.equal(pickNodeForNewSession({ nodes: [node('n1', 20), node('n2', 20)] }), null)
})

test('nó sem medição (running null) NÃO presume vaga', () => {
  assert.equal(pickNodeForNewSession({ nodes: [node('n1', null), node('n2', 19)] }), 'n2')
  assert.equal(pickNodeForNewSession({ nodes: [node('n1', null)] }), null)
})

test('sem nós ou nodeId inválido -> null', () => {
  assert.equal(pickNodeForNewSession({ nodes: [] }), null)
  assert.equal(pickNodeForNewSession(), null)
  assert.equal(pickNodeForNewSession({ nodes: [node('N:1', 0)] }), null)
})

test('teto por nó diferente: vagas livres, não ocupação, decidem', () => {
  assert.equal(pickNodeForNewSession({ nodes: [node('n1', 10, { max: 80 }), node('n2', 5, { max: 20 })] }), 'n1')
})

test('sessão sem nodeId pertence ao n1', () => {
  assert.equal(resolveSessionNodeId({ nodeId: null }), 'n1')
  assert.equal(resolveSessionNodeId(null), 'n1')
  assert.equal(resolveSessionNodeId({ nodeId: 'n2' }), 'n2')
  assert.equal(resolveSessionNodeId({ nodeId: 'lixo:1' }), 'n1')
})

test('MN-01: só coloca sessão inexistente ou nunca pareada e parada', () => {
  assert.equal(shouldPlaceSession(null), true)
  assert.equal(shouldPlaceSession({ nodeId: null, phone: null, status: 'disconnected', lifecycle: 'idle' }), true)
  assert.equal(shouldPlaceSession({ nodeId: null, phone: '5511999990000', status: 'disconnected', lifecycle: 'idle' }), false)
  assert.equal(shouldPlaceSession({ nodeId: null, phone: null, status: 'connecting', lifecycle: 'qr' }), false)
  assert.equal(shouldPlaceSession({ nodeId: 'n2', phone: null, status: 'disconnected', lifecycle: 'idle' }), false)
})

test('MN-03: findDualOwners acha a interseção e ignora nó sem medição', () => {
  assert.deepEqual(findDualOwners({ n1: ['a', 'b'], n2: ['b', 'c'] }), [{ userId: 'b', nodes: ['n1', 'n2'] }])
  assert.deepEqual(findDualOwners({ n1: ['a'], n2: ['b'] }), [])
  assert.deepEqual(findDualOwners({ n1: ['a'], n2: null }), [])
  assert.deepEqual(findDualOwners({ n1: ['a', 'a'] }), [])
})
