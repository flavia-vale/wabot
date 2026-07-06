import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// Regressão: mensagens enviadas pelo próprio número conectado (fromMe) num grupo
// DISTRIBUIDOR monitorado precisam ser espelhadas. Historicamente o handler de
// messages.upsert descartava TODAS as fromMe com um `if (msg.key.fromMe) continue`
// incondicional, quebrando o caso da cliente que envia ela mesma pro grupo
// distribuidor. O comportamento correto é só descartar fromMe quando o grupo NÃO
// é uma fonte monitorada (os envios do robô vão pros grupos de destino, que não
// são fontes). Como esse ramo vive dentro do closure de messages.upsert e o
// bot-worker roda como processo próprio (não exporta a lógica), o guard é
// estrutural — mesmo padrão de bot-worker-retry-cache-wiring.test.js.
test('fromMe não é descartado incondicionalmente (não regride para skip cego)', () => {
  assert.doesNotMatch(
    botWorkerSource,
    /if \(msg\.key\.fromMe\) continue/,
    'o skip incondicional de fromMe foi reintroduzido — isso volta a bloquear o espelhamento de mensagens que a própria dona da conta envia num grupo monitorado',
  )
})

test('o ramo fromMe só descarta quando o grupo NÃO é fonte monitorada', () => {
  const branchIndex = botWorkerSource.indexOf('if (msg.key.fromMe) {')
  assert.notEqual(branchIndex, -1, 'ramo condicional de fromMe não encontrado no handler de upsert')
  // Recorta o bloco do ramo fromMe para inspecionar sua lógica.
  const block = botWorkerSource.slice(branchIndex, branchIndex + 600)
  assert.match(block, /getConfig\(\)/, 'o ramo fromMe precisa consultar a config para saber se o grupo é monitorado')
  assert.match(block, /groups\?\.monitor/, 'o ramo fromMe precisa checar os grupos monitorados (fonte)')
  assert.match(block, /isMonitoredSource/, 'o ramo fromMe precisa decidir com base em ser (ou não) uma fonte monitorada')
  assert.match(block, /if \(!isMonitoredSource\) continue/, 'fromMe fora de fonte monitorada precisa continuar sendo descartado (proteção anti-eco dos envios do robô)')
})
