import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

import { canUseAdvancedPreservation } from '../src/billing/plans.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/ui-anti-banimento.md
// § Gate — fonte ÚNICA `canUseAdvancedPreservation` (src/billing/plans.js).
// FR-015/FR-015a: corrige o Premium bloqueado (a função antiga
// `canAccessAdvancedPreservation` de dashboard/lib/plan.js não liberava
// Premium, só pro/trial-ativo).

const now = new Date('2026-09-23T12:00:00.000Z')
const FIVE_PROFILES = [
  { label: 'Basic', subject: { plan: 'basic', accessExpiresAt: null }, expected: false },
  { label: 'Trial ativo', subject: { plan: 'trial', accessExpiresAt: new Date(now.getTime() + 86400000) }, expected: true },
  { label: 'Trial vencido', subject: { plan: 'trial', accessExpiresAt: new Date(now.getTime() - 86400000) }, expected: false },
  { label: 'PRO', subject: { plan: 'pro', accessExpiresAt: null }, expected: true },
  { label: 'Premium', subject: { plan: 'premium', accessExpiresAt: null }, expected: true },
]

for (const { label, subject, expected } of FIVE_PROFILES) {
  test(`canUseAdvancedPreservation: perfil ${label} → ${expected}`, () => {
    assert.equal(canUseAdvancedPreservation(subject, { now }), expected)
  })
}

test('canAccessAdvancedPreservation não existe mais em dashboard/', () => {
  let out
  try {
    out = execFileSync('grep', ['-rl', 'canAccessAdvancedPreservation', 'dashboard'], { cwd: repoRoot, encoding: 'utf8' })
  } catch (err) {
    if (err.status === 1) { out = '' } else { throw err }
  }
  assert.equal(out.trim(), '', `canAccessAdvancedPreservation ainda aparece em: ${out}`)
})

test('nenhuma função própria de checagem de plano para Anti-banimento existe fora de src/billing/plans.js', () => {
  let out
  try {
    out = execFileSync(
      'grep',
      ['-rnE', 'function can(Access|Use)?.*(Preservation|AntiBan|AntiBanimento)', 'dashboard', 'src'],
      { cwd: repoRoot, encoding: 'utf8' },
    )
  } catch (err) {
    if (err.status === 1) { out = '' } else { throw err }
  }
  const offending = out
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.startsWith('src/billing/plans.js:'))
  assert.deepEqual(offending, [], `função de checagem de plano fora do lugar único: ${offending.join('\n')}`)
})

test('a tela (dashboard/app/painel/anti-banimento) importa canUseAdvancedPreservation diretamente de src/billing/plans.js', () => {
  const layoutPath = resolve(repoRoot, 'dashboard/app/painel/anti-banimento/layout.js')
  const source = readFileSync(layoutPath, 'utf8')
  assert.match(
    source,
    /from ['"](\.\.\/){2,4}src\/billing\/plans\.js['"]/,
    'layout.js precisa importar canUseAdvancedPreservation direto de src/billing/plans.js (mesma fonte do backend)',
  )
  assert.match(source, /canUseAdvancedPreservation/)
})
