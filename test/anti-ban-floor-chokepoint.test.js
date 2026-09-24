import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// Guarda estrutural (padrão de test/bot-worker-retry-cache-wiring.test.js):
// contracts/anti-ban-floor.md exige que só TRÊS arquivos importem
// src/core/antiBanFloor.js. Qualquer outro arquivo importando o módulo, ou
// reimplementando a comparação campo a campo por fora dele, reabre a
// possibilidade de duas fontes discordarem sobre o que é "mais conservador".
const ALLOWED_IMPORTERS = [
  'src/core/preservationConfig.js',
  'src/api/routes/preservation.js',
  'scripts/diag-antiban-valores.mjs',
  // Diagnósticos read-only do incidente 2026-09-24 (PR #1873): medem o
  // impacto do piso importando a regra — nunca reimplementando a comparação.
  'scripts/diag-quem-parou-antiban.mjs',
  'scripts/diag-antiban-parados-agora.mjs',
]

function grepImporters() {
  let out
  try {
    out = execFileSync('grep', ['-rl', "antiBanFloor.js", 'src', 'scripts'], { cwd: repoRoot, encoding: 'utf8' })
  } catch (err) {
    // grep devolve exit code 1 quando não encontra nada — não é erro de execução.
    if (err.status === 1) return []
    throw err
  }
  return out.split('\n').filter(Boolean)
}

test('só os consumidores permitidos importam src/core/antiBanFloor.js', () => {
  const importers = grepImporters()
    // O próprio arquivo se auto-referencia no comentário de topo; não conta.
    .filter((f) => f !== 'src/core/antiBanFloor.js')
  for (const file of importers) {
    assert.ok(
      ALLOWED_IMPORTERS.includes(file),
      `${file} importa antiBanFloor.js mas não está na lista de consumidores permitidos (contracts/anti-ban-floor.md)`,
    )
  }
})

test('antiBanFloor.js não lê process.env diretamente no corpo das funções exportadas (env sempre por parâmetro)', () => {
  const source = readFileSync(join(repoRoot, 'src/core/antiBanFloor.js'), 'utf8')
  const occurrences = source.match(/process\.env/g) || []
  // A única forma aceitável é como DEFAULT de parâmetro de função
  // (`env = process.env)`), nunca uma leitura solta dentro do corpo — a
  // menção em comentário JSDoc não conta como leitura de código.
  const allowedPattern = /env\s*=\s*process\.env\)/g
  const allowedOccurrences = source.match(allowedPattern) || []
  const codeLines = source.split('\n').filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
  const codeSource = codeLines.join('\n')
  const codeOccurrences = codeSource.match(/process\.env/g) || []
  assert.equal(
    codeOccurrences.length,
    allowedOccurrences.length,
    `process.env só pode aparecer como default de parâmetro no código (achado ${occurrences.length} no total, ${codeOccurrences.length} fora de comentário)`,
  )
})
