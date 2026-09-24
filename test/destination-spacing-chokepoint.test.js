import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Guarda estrutural (padrão de test/anti-ban-floor-chokepoint.test.js /
// test/bot-worker-retry-cache-wiring.test.js): contracts/destination-spacing.md
// exige que só TRÊS arquivos importem src/core/destinationSpacing.js, e que
// nenhum outro arquivo calcule espera entre destinos comparando
// channelStaggerJitterMs por fora do módulo.
const ALLOWED_IMPORTERS = [
  'src/bot-worker.js',
  'src/core/channelThrottle.js',
  // Só usa toDestinationIntervalMs (leitura/formatação para exibir
  // "Intervalo entre destinos" em segundos no GET /config) — nunca
  // decideDestinationSpacing/combineGateDecisions. contracts/api-preservation.md
  // § Leitura exige o campo aditivo `effective.destinationIntervalSec`.
  'src/api/routes/preservation.js',
  'scripts/diag-antiban-valores.mjs',
]

function grepFiles(pattern, dirs) {
  let out
  try {
    out = execFileSync('grep', ['-rl', pattern, ...dirs], { cwd: repoRoot, encoding: 'utf8' })
  } catch (err) {
    if (err.status === 1) return []
    throw err
  }
  return out.split('\n').filter(Boolean)
}

test('só os consumidores permitidos importam src/core/destinationSpacing.js', () => {
  // Grep de IMPORT de verdade (from '...destinationSpacing.js'), não qualquer
  // menção em comentário/JSDoc a "destinationSpacing.js" (ex.: o comentário de
  // topo de antiBanFloor.js cita o nome do arquivo irmão como referência).
  const importers = grepFiles("from '.*destinationSpacing\\.js'", ['src', 'scripts'])
    .filter((f) => f !== 'src/core/destinationSpacing.js')
  for (const file of importers) {
    assert.ok(
      ALLOWED_IMPORTERS.includes(file),
      `${file} importa destinationSpacing.js mas não está na lista de consumidores permitidos (contracts/destination-spacing.md)`,
    )
  }
})

test('src/api/routes/preservation.js só importa toDestinationIntervalMs de destinationSpacing.js (nunca decide/combina)', () => {
  const source = readFileSync(join(repoRoot, 'src/api/routes/preservation.js'), 'utf8')
  const importLine = source.split('\n').find((line) => line.includes("from '../../core/destinationSpacing.js'"))
  assert.ok(importLine, 'preservation.js precisa importar de core/destinationSpacing.js')
  assert.match(importLine, /\btoDestinationIntervalMs\b/)
  for (const forbidden of ['decideDestinationSpacing', 'combineGateDecisions', 'reserveSpacingSlot']) {
    assert.doesNotMatch(importLine, new RegExp(`\\b${forbidden}\\b`), `preservation.js não pode importar ${forbidden} — só formata para exibição`)
  }
})

test('channelStaggerJitterMs só é lido/comparado em bot-worker.js e no módulo de espaçamento/rotas de config', () => {
  const files = grepFiles('channelStaggerJitterMs', ['src'])
  const allowed = new Set([
    'src/bot-worker.js',
    'src/core/destinationSpacing.js',
    'src/api/routes/preservation.js',
  ])
  for (const file of files) {
    assert.ok(allowed.has(file), `${file} lê/compara channelStaggerJitterMs fora dos consumidores permitidos`)
  }
})

test('bot-worker.js não sorteia stagger a partir de channelStaggerJitterMs (Math.random) — o intervalo entre destinos é FIXO, decidido só por destinationSpacing.js', () => {
  const source = readFileSync(join(repoRoot, 'src/bot-worker.js'), 'utf8')
  assert.doesNotMatch(
    source,
    /Math\.random\(\)\s*\*\s*staggerJitterMs/,
    'sorteio antigo de staggerMs não pode existir mais — a espera passou a ser fixa e decidida por decideDestinationSpacing',
  )
})
