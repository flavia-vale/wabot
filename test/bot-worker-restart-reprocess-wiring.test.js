import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA: cliente reclamou de ofertas perdidas com errorMsg `error:worker_restart`
// ("O bot reiniciou enquanto essa mensagem estava esperando para ser
// enviada") a cada deploy/restart do worker — a fila em memória some junto
// com o processo e markInterruptedSendLogs() só MARCAVA como erro, nunca
// reenfileirava. reprocessRestartFailures() fecha esse buraco: a cada boot,
// reenfileira o que morreu no restart anterior remontando o MESMO card
// manual do envio ao vivo (foto raspada da loja + marca d'água do destino),
// via buildPayload lazy (roda no dequeue, não no boot, para não atrasar a
// reconexão do WhatsApp com I/O de scrape/upload). Teste estrutural (grep de
// source) pelo mesmo motivo dos demais bot-worker-*-wiring.test.js:
// bot-worker.js roda como processo próprio e não expõe essa lógica para
// import direto.

test('reprocessRestartFailures é chamada logo após markInterruptedSendLogs no boot', () => {
  const markIndex = botWorkerSource.indexOf('await markInterruptedSendLogs()')
  assert.notEqual(markIndex, -1, 'chamada a markInterruptedSendLogs() não encontrada')
  const nextChunk = botWorkerSource.slice(markIndex, markIndex + 300)
  assert.match(nextChunk, /reprocessRestartFailures\(\)/, 'reprocessRestartFailures() precisa rodar logo após markInterruptedSendLogs() no boot')
})

test('reprocessRestartFailures só reprocessa error:worker_restart exato (não o já reenfileirado)', () => {
  const fnIndex = botWorkerSource.indexOf('async function reprocessRestartFailures()')
  assert.notEqual(fnIndex, -1, 'reprocessRestartFailures não encontrada')
  const fnEnd = botWorkerSource.indexOf('\nasync function createSendBackend()', fnIndex)
  const fnBody = botWorkerSource.slice(fnIndex, fnEnd === -1 ? undefined : fnEnd)

  // Query inicial: exact match, não prefixo — senão reprocessaria a própria
  // linha que ela mesma marcou como 'error:worker_restart:requeued'.
  assert.match(fnBody, /errorMsg:\s*'error:worker_restart'/, 'filtro inicial precisa casar exatamente error:worker_restart')
  // Marca a linha original como :requeued (não some do painel, só sai do filtro).
  assert.match(fnBody, /errorMsg:\s*'error:worker_restart:requeued'/, 'linha original precisa ser marcada como requeued para não reprocessar de novo')
  // Mensagens agendadas têm fluxo próprio (scheduledMessage.status) — não entram aqui.
  assert.match(fnBody, /platform:\s*\{\s*not:\s*'scheduled'\s*\}/, 'mensagens agendadas (platform scheduled) precisam ficar de fora do reprocessamento')
  // Escape hatch operacional, sem precisar de deploy para desligar.
  assert.match(fnBody, /WORKER_RESTART_REPROCESS_ENABLED/, 'precisa ter escape hatch por env var')
})

test('reprocessRestartFailures remonta o card manual (foto+watermark) via buildPayload lazy, não texto puro no boot', () => {
  const fnIndex = botWorkerSource.indexOf('async function reprocessRestartFailures()')
  assert.notEqual(fnIndex, -1, 'reprocessRestartFailures não encontrada')
  const fnEnd = botWorkerSource.indexOf('\nasync function createSendBackend()', fnIndex)
  const fnBody = botWorkerSource.slice(fnIndex, fnEnd === -1 ? undefined : fnEnd)

  // buildPayload (não `payload: { text }` eager) — a montagem do card só pode
  // rodar no dequeue (depois do socket abrir), nunca bloqueando o boot.
  assert.match(fnBody, /buildPayload:\s*async\s*\(\)\s*=>/, 'precisa usar buildPayload lazy, não montar o payload no boot')
  assert.match(fnBody, /buildManualLinkPreview\(/, 'precisa reusar buildManualLinkPreview (mesmo card do envio ao vivo)')
  assert.doesNotMatch(fnBody, /payload:\s*\{\s*text:/, 'não deve mais enfileirar como texto puro — isso perde o card com foto')
  // Marca d'água/imageMode são config POR DESTINO — precisam ser recalculados
  // aqui, não herdados da oferta original perdida.
  assert.match(fnBody, /destinationImageUsesWatermark\(/, 'precisa resolver a marca d\'água do destino antes de montar o card')
})
