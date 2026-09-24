import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { buildFeatureGateError, FEATURE_CODES } from '../src/billing/plans.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/api-preservation.md
// § Gate de plano — a mensagem muda para "Anti-banimento", mas code/feature/
// requiredPlan e os códigos HTTP dos 3 pontos de recusa continuam iguais.

test('mensagem de recusa cita "Anti-banimento" e não cita jargão antigo', () => {
  const err = buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION)
  assert.match(err.error, /Anti-banimento/)
  assert.doesNotMatch(err.error, /Preservação Avançada/)
  assert.doesNotMatch(err.error, /Módulo de Preservação/)
})

test('code/feature/requiredPlan continuam inalterados', () => {
  const err = buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION)
  assert.equal(err.code, 'FEATURE_REQUIRES_PRO')
  assert.equal(err.feature, FEATURE_CODES.ADVANCED_PRESERVATION)
  assert.equal(err.requiredPlan, 'pro')
})

test('os três pontos de recusa continuam com os mesmos códigos HTTP de hoje', () => {
  const preservation = readFileSync(resolve(repoRoot, 'src/api/routes/preservation.js'), 'utf8')
  const config = readFileSync(resolve(repoRoot, 'src/api/routes/config.js'), 'utf8')
  const groups = readFileSync(resolve(repoRoot, 'src/api/routes/groups.js'), 'utf8')

  assert.match(preservation, /reply\.code\(402\)\.send\(buildFeatureGateError\(FEATURE_CODES\.ADVANCED_PRESERVATION\)\)/)
  assert.match(config, /reply\.code\(403\)\.send\(buildFeatureGateError\(FEATURE_CODES\.ADVANCED_PRESERVATION\)\)/)
  assert.match(groups, /reply\.code\(403\)\.send\(buildFeatureGateError\(FEATURE_CODES\.ADVANCED_PRESERVATION\)\)/)
})
