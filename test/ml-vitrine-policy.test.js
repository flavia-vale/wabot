import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideVitrineFallback } from '../src/converters/mlVitrinePolicy.js'

// Suite dedicada ao contrato `specs/007-ml-vitrine-fallback-expired/contracts/decide-vitrine-fallback.md`.
// Cobre 1:1 as 11 linhas da tabela-verdade normativa.

const TRUTH_TABLE = [
  { n: 1, failureType: 'unsupported_url', isDirectVitrine: false, hasVitrine: true, outcome: 'use_vitrine' },
  { n: 2, failureType: 'unsupported_url', isDirectVitrine: true, hasVitrine: true, outcome: 'use_vitrine' },
  { n: 3, failureType: 'unsupported_url', isDirectVitrine: true, hasVitrine: false, outcome: 'missing_vitrine' },
  { n: 4, failureType: 'unsupported_url', isDirectVitrine: false, hasVitrine: false, outcome: 'discard' },
  { n: 5, failureType: 'expired', isDirectVitrine: true, hasVitrine: true, outcome: 'use_vitrine' },
  { n: 6, failureType: 'expired', isDirectVitrine: true, hasVitrine: false, outcome: 'missing_vitrine' },
  { n: 7, failureType: 'expired', isDirectVitrine: false, hasVitrine: true, outcome: 'passthrough' },
  { n: 8, failureType: 'expired', isDirectVitrine: false, hasVitrine: false, outcome: 'passthrough' },
  { n: 9, failureType: 'forbidden', isDirectVitrine: true, hasVitrine: true, outcome: 'passthrough' },
  { n: 10, failureType: 'rate_limited', isDirectVitrine: true, hasVitrine: false, outcome: 'passthrough' },
  { n: 11, failureType: undefined, isDirectVitrine: true, hasVitrine: true, outcome: 'passthrough' },
]

for (const row of TRUTH_TABLE) {
  test(`decideVitrineFallback linha ${row.n}: failureType=${row.failureType} isDirectVitrine=${row.isDirectVitrine} hasVitrine=${row.hasVitrine} -> ${row.outcome}`, () => {
    const outcome = decideVitrineFallback({
      failureType: row.failureType,
      isDirectVitrine: row.isDirectVitrine,
      hasVitrine: row.hasVitrine,
    })
    assert.equal(outcome, row.outcome)
  })
}

test('decideVitrineFallback: pura — mesma entrada produz sempre a mesma saída', () => {
  const input = { failureType: 'expired', isDirectVitrine: true, hasVitrine: true }
  const first = decideVitrineFallback(input)
  const second = decideVitrineFallback({ ...input })
  assert.equal(first, second)
  assert.equal(first, 'use_vitrine')
})
