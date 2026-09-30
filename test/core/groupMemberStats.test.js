import test from 'node:test'
import assert from 'node:assert/strict'
import { computeDelta, summarizeGroupMembers, pruneMemberSampleIds } from '../../src/core/groupMemberStats.js'

const NOW = new Date('2026-09-30T12:00:00Z')
const at = (hoursAgo, size, id) => ({ id, size, sampledAt: new Date(NOW.getTime() - hoursAgo * 3600_000) })

test('variação 24h usa a amostra de ~24h atrás', () => {
  const d = computeDelta([at(0, 110, 'a'), at(24, 100, 'b'), at(1, 108, 'c')], 1, NOW)
  assert.deepEqual(d, { diff: 10, pct: 10 })
})

test('histórico curto demais devolve null (não inventa variação)', () => {
  assert.equal(computeDelta([at(0, 110, 'a'), at(2, 105, 'b')], 7, NOW), null)
  assert.equal(computeDelta([at(0, 110, 'a')], 1, NOW), null)
})

test('queda gera diff negativo e base zero não divide', () => {
  assert.deepEqual(computeDelta([at(0, 90, 'a'), at(168, 100, 'b')], 7, NOW), { diff: -10, pct: -10 })
  assert.equal(computeDelta([at(0, 5, 'a'), at(24, 0, 'b')], 1, NOW).pct, null)
})

test('summarize marca stale quando a última amostra passou de 3h', () => {
  assert.equal(summarizeGroupMembers([at(1, 10, 'a')], NOW).stale, false)
  assert.equal(summarizeGroupMembers([at(5, 10, 'a')], NOW).stale, true)
  assert.equal(summarizeGroupMembers([], NOW).stale, true)
})

test('prune mantém tudo <7d, 1/dia até 90d e apaga >90d', () => {
  const samples = [
    at(1, 1, 'novo1'), at(2, 1, 'novo2'),
    at(24 * 10 + 1, 1, 'd10-a'), at(24 * 10 + 5, 1, 'd10-b'),
    at(24 * 100, 1, 'velho'),
  ]
  const del = pruneMemberSampleIds(samples, NOW).sort()
  assert.deepEqual(del, ['d10-b', 'velho'])
})
