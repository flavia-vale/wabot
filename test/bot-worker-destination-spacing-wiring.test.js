import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// Guarda estrutural (padrão de test/bot-worker-retry-cache-wiring.test.js):
// contracts/destination-spacing.md — prova, lendo o source, que o
// "Intervalo entre destinos" deixou de ser um sorteio inline dentro da fila
// serial e passou a ser SEMPRE um adiamento (deferSendJob), mesmo curto
// (FR-024), e que a ordem canônica de processSendJob foi preservada.

test('o sorteio antigo de staggerMs (Math.random * staggerJitterMs) não existe mais no enqueue', () => {
  assert.doesNotMatch(
    botWorkerSource,
    /Math\.random\(\)\s*\*\s*staggerJitterMs/,
    'o intervalo entre destinos passou a ser FIXO (decidido por decideDestinationSpacing), não sorteado',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const\s+staggerMs\s*=\s*\(destIndex\s*>\s*0/,
    'a variável staggerMs do enqueue antigo não pode mais existir',
  )
})

test('processSendJob não faz sleep(job.delayMs) nem soma delayMs ao smart delay/freio de pressão', () => {
  const startIdx = botWorkerSource.indexOf('async function processSendJob(job) {')
  assert.notEqual(startIdx, -1, 'processSendJob não encontrada')
  const endIdx = botWorkerSource.indexOf('\nasync function ', startIdx + 10)
  const body = botWorkerSource.slice(startIdx, endIdx === -1 ? undefined : endIdx)
  assert.doesNotMatch(
    body,
    /job\.delayMs/,
    'processSendJob não pode mais somar job.delayMs ao smart delay — a espera entre destinos vem só do espaçamento',
  )
})

test('toda espera decidida pelo espaçamento termina em deferSendJob, nunca em espera inline (mesmo curta)', () => {
  const importIdx = botWorkerSource.indexOf("from './core/destinationSpacing.js'")
  assert.notEqual(importIdx, -1, 'processSendJob precisa importar de core/destinationSpacing.js')

  const startIdx = botWorkerSource.indexOf('async function processSendJob(job) {')
  const endIdx = botWorkerSource.indexOf('\nasync function ', startIdx + 10)
  const body = botWorkerSource.slice(startIdx, endIdx === -1 ? undefined : endIdx)

  assert.match(body, /combineGateDecisions\(/, 'processSendJob precisa combinar a decisão do destino com a do espaçamento')
  assert.match(body, /decideDestinationSpacing\(/, 'processSendJob precisa decidir o espaçamento')
  assert.match(body, /reserveSpacingSlot\(/, 'processSendJob precisa atualizar o estado de espaçamento no momento em que o gate decide')

  // A espera vinda do ESPAÇAMENTO (source !== 'destination') sempre chama
  // deferSendJob — nunca THROTTLE_INLINE_WAIT_MAX_MS/sleep inline, mesmo
  // quando a espera é curta (FR-024).
  const combineCallIdx = body.indexOf('combineGateDecisions(')
  const afterCombine = body.slice(combineCallIdx)
  const deferIdx = afterCombine.indexOf('deferSendJob(')
  assert.notEqual(deferIdx, -1, 'deferSendJob precisa ser chamado depois da combinação')
})

test('ordem canônica preservada: preservação → vínculo → idade → freio de pressão → gate combinado (destino+espaçamento) → tentativas de envio', () => {
  const startIdx = botWorkerSource.indexOf('async function processSendJob(job) {')
  const endIdx = botWorkerSource.indexOf('\nasync function ', startIdx + 10)
  const body = botWorkerSource.slice(startIdx, endIdx === -1 ? undefined : endIdx)

  const idxPreservation = body.indexOf('resolveDestinationPreservation(')
  const idxUnlink = body.indexOf('shouldDropUnlinkedDestination(')
  const idxExpiry = body.indexOf('shouldDropExpiredQueueJob(')
  const idxPressure = body.indexOf('buildQueuePressureDelayMs(')
  const idxSpacing = body.indexOf('decideDestinationSpacing(')
  const idxCombine = body.indexOf('combineGateDecisions(')
  const idxAttempt = body.indexOf('for (let attempt = 1;')

  for (const [name, idx] of [
    ['resolveDestinationPreservation', idxPreservation],
    ['shouldDropUnlinkedDestination', idxUnlink],
    ['shouldDropExpiredQueueJob', idxExpiry],
    ['buildQueuePressureDelayMs', idxPressure],
    ['decideDestinationSpacing', idxSpacing],
    ['combineGateDecisions', idxCombine],
    ['attempt loop', idxAttempt],
  ]) {
    assert.notEqual(idx, -1, `${name} não encontrado em processSendJob`)
  }

  assert.ok(idxPreservation < idxUnlink, 'preservação resolve antes da revalidação de vínculo')
  assert.ok(idxUnlink < idxExpiry, 'revalidação de vínculo antes do descarte por idade')
  assert.ok(idxExpiry < idxPressure, 'descarte por idade antes do freio de pressão')
  assert.ok(idxPressure < idxSpacing, 'freio de pressão antes do espaçamento')
  assert.ok(idxSpacing < idxCombine, 'espaçamento decidido antes de combinar com o gate do destino')
  assert.ok(idxCombine < idxAttempt, 'gate combinado decide antes das tentativas de envio')
})
