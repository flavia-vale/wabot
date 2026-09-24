import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')
const dispatcherSource = readFileSync(join(__dirname, '../src/offerAutomation/dispatcher.js'), 'utf8')

// specs/017-client-coupon-catalog (Trava #2 — invariante central do plano):
// os três caminhos de envio (espelhamento/`converted`, fila de ofertas/
// `broadcast`, ambos dentro de `processSendJob`, e o laço de `runAutomation`
// no dispatcher) precisam convergir na MESMA função `applyCouponToken`
// (src/core/clientCouponPolicy.js) para substituir o token `{cupom}` — nenhum
// caminho pode reimplementar substituição de token por conta própria, e o
// token nunca pode chegar ao WhatsApp sem passar por ali. Teste estrutural
// (lê source via readFileSync, sem importar) porque bot-worker.js roda como
// processo próprio e dispatcher.js expõe só a função pública `runAutomation`
// — nenhum dos dois expõe essa lógica interna para import direto. Mesmo
// espírito de test/bot-worker-retry-cache-wiring.test.js.

test('bot-worker.js e dispatcher.js importam applyCouponToken do MESMO módulo compartilhado', () => {
  assert.match(
    botWorkerSource,
    /import\s*\{[^}]*\bapplyCouponToken\b[^}]*\}\s*from\s*['"]\.\/core\/clientCouponPolicy\.js['"]/,
    'src/bot-worker.js precisa importar applyCouponToken de ./core/clientCouponPolicy.js',
  )
  assert.match(
    dispatcherSource,
    /import\s*\{[^}]*\bapplyCouponToken\b[^}]*\}\s*from\s*['"]\.\.\/core\/clientCouponPolicy\.js['"]/,
    'src/offerAutomation/dispatcher.js precisa importar applyCouponToken de ../core/clientCouponPolicy.js (mesmo arquivo físico que ./core/clientCouponPolicy.js em bot-worker.js)',
  )
})

test('bot-worker.js tem UMA única chamada real a applyCouponToken(...) — nenhum caminho reimplementa a substituição', () => {
  const callSites = botWorkerSource.match(/\bapplyCouponToken\(/g) || []
  assert.equal(
    callSites.length,
    1,
    `esperado exatamente 1 chamada a applyCouponToken( em bot-worker.js (achei ${callSites.length}) — os caminhos converted e broadcast compartilham processSendJob, então devem convergir num único ponto de substituição`,
  )
})

test('a chamada de applyCouponToken em bot-worker.js acontece DENTRO de processSendJob, ANTES de sendPreparedPayload', () => {
  const processSendJobStart = botWorkerSource.indexOf('async function processSendJob(job) {')
  assert.notEqual(processSendJobStart, -1, 'processSendJob não encontrada')

  // Próxima função de topo-de-nível depois de processSendJob delimita o
  // corpo da função para a busca (mesmo padrão de escopo usado no wiring do
  // retry cache).
  const nextFunctionMatch = botWorkerSource.slice(processSendJobStart + 1).search(/\nasync function \w+\(|\nfunction \w+\(/)
  const processSendJobEnd = nextFunctionMatch === -1 ? botWorkerSource.length : processSendJobStart + 1 + nextFunctionMatch
  const body = botWorkerSource.slice(processSendJobStart, processSendJobEnd)

  const substitutionIndex = body.indexOf('applyCouponTokenToPayload(payload, couponText)')
  const sendIndex = body.indexOf('sendPreparedPayload({ sock: sockForAttempt')

  assert.notEqual(substitutionIndex, -1, 'chamada a applyCouponTokenToPayload não encontrada dentro de processSendJob')
  assert.notEqual(sendIndex, -1, 'chamada a sendPreparedPayload({ sock: sockForAttempt não encontrada dentro de processSendJob')
  assert.ok(
    substitutionIndex < sendIndex,
    'a substituição do token {cupom} precisa acontecer ANTES do envio (sendPreparedPayload), nunca depois',
  )
})

test('o job do caminho `converted` (espelhamento) é enfileirado SEM chamar applyCouponToken/renderCouponText antes — o token viaja intacto até o dequeue', () => {
  const couponContextStart = botWorkerSource.indexOf('let couponContext = null')
  assert.notEqual(couponContextStart, -1, 'ponto de resolução de couponContext (mirror) não encontrado')

  const enqueueConvertedIndex = botWorkerSource.indexOf("type: 'converted',", couponContextStart)
  assert.notEqual(enqueueConvertedIndex, -1, "enqueueSendJob({ type: 'converted', ... }) não encontrado depois da resolução de couponContext")

  const enqueueCallIndex = botWorkerSource.lastIndexOf('enqueueSendJob({', enqueueConvertedIndex)
  assert.notEqual(enqueueCallIndex, -1, 'chamada enqueueSendJob( correspondente ao job converted não encontrada')

  const segment = botWorkerSource.slice(couponContextStart, enqueueCallIndex)
  assert.doesNotMatch(
    segment,
    /\bapplyCouponToken\(|\brenderCouponText\(/,
    'nenhum job pode ser enfileirado já com {cupom} substituído — a substituição acontece só no dequeue (processSendJob)',
  )
})

test('o job do caminho `broadcast` (fila de ofertas) é enfileirado SEM chamar applyCouponToken/renderCouponText antes — o token viaja intacto até o dequeue', () => {
  const broadcastContextIndex = botWorkerSource.indexOf('const broadcastCouponContext =')
  assert.notEqual(broadcastContextIndex, -1, 'ponto de resolução de broadcastCouponContext não encontrado')

  const enqueueBroadcastIndex = botWorkerSource.indexOf("type: 'broadcast',", broadcastContextIndex)
  assert.notEqual(enqueueBroadcastIndex, -1, "enqueueSendJob({ type: 'broadcast', ... }) não encontrado depois da resolução de broadcastCouponContext")

  const enqueueCallIndex = botWorkerSource.lastIndexOf('enqueueSendJob({', enqueueBroadcastIndex)
  assert.notEqual(enqueueCallIndex, -1, 'chamada enqueueSendJob( correspondente ao job broadcast não encontrada')

  const segment = botWorkerSource.slice(broadcastContextIndex, enqueueCallIndex)
  assert.doesNotMatch(
    segment,
    /\bapplyCouponToken\(|\brenderCouponText\(/,
    'nenhum job pode ser enfileirado já com {cupom} substituído — a substituição acontece só no dequeue (processSendJob)',
  )
})

test('dispatcher.js (runAutomation) chama applyCouponToken ANTES do envio (sendBroadcastFn), convergindo na mesma função', () => {
  const runAutomationStart = dispatcherSource.indexOf('export async function runAutomation(')
  assert.notEqual(runAutomationStart, -1, 'runAutomation não encontrada em dispatcher.js')

  const substitutionIndex = dispatcherSource.indexOf('applyCouponToken(varied, couponText)', runAutomationStart)
  const sendIndex = dispatcherSource.indexOf('await sendBroadcastFn(automation.userId, text,', runAutomationStart)

  assert.notEqual(substitutionIndex, -1, 'chamada a applyCouponToken(varied, couponText) não encontrada dentro de runAutomation')
  assert.notEqual(sendIndex, -1, 'chamada a sendBroadcastFn não encontrada dentro de runAutomation')
  assert.ok(
    substitutionIndex < sendIndex,
    'a substituição do token {cupom} precisa acontecer ANTES do envio (sendBroadcastFn), nunca depois',
  )
})
