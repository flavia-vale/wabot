import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// specs/006-worker-crash-log-safety (User Story 2): uma falha ao gravar
// MessageLog no handler de broadcast (`db.messageLog.create()`) não pode
// virar unhandledRejection -> process.exit(1) do crash-guard, o que
// descartaria toda a fila de envio em memória para os demais jids do loop.
// Teste estrutural (grep de source) porque bot-worker.js roda como processo
// próprio e não é importável em node:test (mesmo padrão de
// bot-worker-retry-cache-wiring.test.js).
test('db.messageLog.create() do handler broadcast está dentro de um try/catch', () => {
  const handlerIndex = botWorkerSource.indexOf("msg?.type === 'broadcast'")
  assert.notEqual(handlerIndex, -1, 'handler type:\'broadcast\' não encontrado')

  const createIndex = botWorkerSource.indexOf('await db.messageLog.create(', handlerIndex)
  assert.notEqual(createIndex, -1, 'db.messageLog.create() não encontrado dentro do handler de broadcast')

  const tryIndex = botWorkerSource.lastIndexOf('try {', createIndex)
  assert.notEqual(tryIndex, -1, 'db.messageLog.create() do broadcast precisa estar dentro de um bloco try')

  const catchIndex = botWorkerSource.indexOf('} catch (', createIndex)
  assert.notEqual(catchIndex, -1, 'bloco catch correspondente não encontrado após o create()')

  // Nenhum outro `try {` deve aparecer entre o try encontrado e o create —
  // garante que é o try mais próximo (envolvendo diretamente a chamada).
  const tryToCreate = botWorkerSource.slice(tryIndex + 'try {'.length, createIndex)
  assert.equal(tryToCreate.includes('try {'), false, 'deve ser o try mais interno envolvendo o create()')
})

test('catch do create() de broadcast não usa process.exit nem relança (throw)', () => {
  const handlerIndex = botWorkerSource.indexOf("msg?.type === 'broadcast'")
  const createIndex = botWorkerSource.indexOf('await db.messageLog.create(', handlerIndex)
  const catchIndex = botWorkerSource.indexOf('} catch (', createIndex)
  assert.notEqual(catchIndex, -1)

  // Bloco do catch: do "catch (" até o próximo "continue" (que é o sinal de
  // que o loop segue sem lançar) — delimita o corpo do catch para inspeção.
  const continueIndex = botWorkerSource.indexOf('continue', catchIndex)
  assert.notEqual(continueIndex, -1, 'catch precisa terminar com continue para seguir o loop de jids')

  const catchBody = botWorkerSource.slice(catchIndex, continueIndex)
  assert.equal(/\bthrow\b/.test(catchBody), false, 'catch não pode relançar (throw) — derrubaria o worker')
  assert.equal(/process\.exit/.test(catchBody), false, 'catch não pode chamar process.exit')
})

test('handler de broadcast segue processando os demais jids após uma falha de log (continue, não return)', () => {
  const handlerIndex = botWorkerSource.indexOf("msg?.type === 'broadcast'")
  const createIndex = botWorkerSource.indexOf('await db.messageLog.create(', handlerIndex)
  const catchIndex = botWorkerSource.indexOf('} catch (', createIndex)
  const continueIndex = botWorkerSource.indexOf('continue', catchIndex)
  const catchBody = botWorkerSource.slice(catchIndex, continueIndex + 'continue'.length)

  assert.match(catchBody, /continue\s*$/, 'catch deve terminar em continue (não return) para não abortar os demais jids')
})
