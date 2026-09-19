import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA 2026-07: quando accessExpiresAt vence, o worker mandava só um IPC
// {type:'status', data:'blocked'} (nunca persistido no WaSession pelo
// consumidor em sessionCore.js) e saía pelo exit do runtime. WaSession.status
// ficava preso no último valor antes do vencimento (normalmente 'connected'),
// e o health monitor do bot-supervisor (que só busca status IN
// ('connected','connecting') pra ressuscitar) tentava religar a sessão pra
// sempre — fork, detecta vencido, sai, 15s depois tenta de novo, loop
// infinito de restart/quarentena. Teste estrutural (grep de source) porque
// bot-worker.js roda como processo próprio, mesmo padrão de
// bot-worker-retry-cache-wiring.test.js.
test('bloco de acesso expirado persiste WaSession antes de sair do processo', () => {
  const blockStart = botWorkerSource.indexOf('if (user.accessExpiresAt && user.accessExpiresAt < new Date())')
  assert.notEqual(blockStart, -1, 'bloco de checagem de accessExpiresAt não encontrado')
  const blockEnd = botWorkerSource.indexOf('exitRuntime(0)', blockStart)
  assert.notEqual(blockEnd, -1, 'exitRuntime(0) não encontrado dentro do bloco')

  const block = botWorkerSource.slice(blockStart, blockEnd)
  assert.match(
    block,
    /persistSessionPatch\(\s*\{\s*status:\s*'disconnected'/,
    'accessExpiresAt vencido precisa persistir status=disconnected no WaSession antes de encerrar o runtime, senão o health monitor do supervisor tenta ressuscitar a sessão pra sempre',
  )
})
