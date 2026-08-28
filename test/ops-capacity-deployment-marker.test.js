import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDeploymentRevision, sanitizeDeploymentRevision } from '../src/ops/capacity/deploymentMarker.js'

test('deployment marker aceita somente SHA e nunca persiste entrada arbitrária', async () => {
  assert.equal(sanitizeDeploymentRevision('ABCDEF1234567890'), 'abcdef123456')
  assert.equal(sanitizeDeploymentRevision('/repo?token=secret'), null)
  const fromEnv = await resolveDeploymentRevision({ env: { WABOT_GIT_SHA: '1234567890abcdef' }, run: async () => { throw new Error('não deve executar') } })
  assert.equal(fromEnv, '1234567890ab')
})

test('deployment marker usa git HEAD conclusivo e falha fechado', async () => {
  const revision = await resolveDeploymentRevision({ env: {}, run: async (file, args) => { assert.equal(file, 'git'); assert.deepEqual(args, ['rev-parse', '--verify', 'HEAD']); return { stdout: 'abcdef0123456789\n' } } })
  assert.equal(revision, 'abcdef012345')
  assert.equal(await resolveDeploymentRevision({ env: {}, run: async () => { throw new Error('git indisponível') } }), null)
})
