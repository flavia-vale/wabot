import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Feature 017 (arquitetura multicanal de entrega), FR-037/D-A4 do plano:
// `DELIVERY_NETWORKS_ENABLED` é lido SÓ na montagem da configuração, na API
// (src/billing/groupEntitlements.js). Nenhum arquivo de código de worker lê
// essa env — é o que garante que ligar/desligar o Telegram nunca exige
// reiniciar o bot-supervisor (o que reconectaria TODAS as sessões de
// WhatsApp de uma vez).
//
// Teste estático (grep de source): varre os arquivos de código de worker e
// falha se qualquer um contiver `process.env.DELIVERY_NETWORKS_ENABLED`.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

function listJsFilesRecursive(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...listJsFilesRecursive(full))
    else if (entry.endsWith('.js')) out.push(full)
  }
  return out
}

const WORKER_PATHS = [
  'src/bot-worker.js',
  'src/core',
  'src/supervisor',
  'src/manager.js',
]

test('nenhum arquivo de código de worker lê process.env.DELIVERY_NETWORKS_ENABLED', () => {
  const checked = []
  for (const rel of WORKER_PATHS) {
    const full = path.join(repoRoot, rel)
    if (!existsSync(full)) continue
    const files = statSync(full).isDirectory() ? listJsFilesRecursive(full) : [full]
    for (const file of files) {
      // src/core/delivery/ é o único lugar do código onde a rede de entrega é
      // definida — mas ele é PURO e não lê env de rollout (recebe `env` por
      // parâmetro em isDeliveryNetworkEnabled). Ainda assim, a regra vale
      // igual: nem ele pode ler process.env.DELIVERY_NETWORKS_ENABLED direto.
      const source = readFileSync(file, 'utf8')
      checked.push(file)
      assert.doesNotMatch(
        source,
        /process\.env\.DELIVERY_NETWORKS_ENABLED/,
        `${path.relative(repoRoot, file)}: código de worker não pode ler DELIVERY_NETWORKS_ENABLED — isso obrigaria reiniciar o bot-supervisor para ligar/desligar o Telegram`,
      )
    }
  }
  assert.ok(checked.length > 10, 'esperava varrer um número razoável de arquivos de worker')
})
