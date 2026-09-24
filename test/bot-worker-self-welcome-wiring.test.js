import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// Piloto de reforço de ativação (2026-09-23/24): 4 mensagens pelo próprio
// WhatsApp. Testes estruturais (grep de source) porque bot-worker.js roda
// como processo próprio — mesmo padrão de bot-worker-retry-cache-wiring.test.js.

test('a decisão de enviar é IMPORTADA de src/core/selfWelcomeMessage.js, nunca reescrita aqui', () => {
  assert.match(src, /from '\.\/core\/selfWelcomeMessage\.js'/)
  assert.match(src, /shouldSendSelfWelcomeMessage/)
  assert.match(src, /decideActivationNudge/)
  assert.match(src, /resolveSelfWelcomePilotEmails/)
  assert.match(src, /isPilotEmail/)
})

test('hadPhoneBefore é lido ANTES do persistSessionPatch sobrescrever o telefone', () => {
  const readIndex = src.indexOf('hadPhoneBeforeThisOpen = Boolean(')
  const persistIndex = src.indexOf("await persistSessionPatch({ status: 'connected', phone,")
  assert.notEqual(readIndex, -1, 'leitura de hadPhoneBeforeThisOpen não encontrada')
  assert.notEqual(persistIndex, -1, 'persistSessionPatch da conexão não encontrado')
  assert.ok(
    readIndex < persistIndex,
    'ler o telefone anterior DEPOIS de persistSessionPatch sempre vê o valor já sobrescrito — reenviaria a cada reconexão',
  )
})

test('as 3 funções de envio calculam o destino como o PRÓPRIO número, nunca grupo/contato', () => {
  for (const fnName of ['maybeSendSelfWelcomeMessage', 'maybeSendFirstOfferMessage', 'maybeSendActivationNudge']) {
    const fnStart = src.indexOf(`async function ${fnName}(`)
    assert.notEqual(fnStart, -1, `${fnName} não encontrada`)
    const fnBody = src.slice(fnStart, fnStart + 3200)
    assert.match(fnBody, /\$\{phone\}@s\.whatsapp\.net/, `${fnName} precisa mandar para \${phone}@s.whatsapp.net`)
    assert.doesNotMatch(fnBody, /@g\.us|@newsletter/, `${fnName} não pode ter jid de grupo/canal`)
  }
})

test('best-effort: as 3 funções de envio têm catch próprio e são chamadas com .catch() no site de chamada', () => {
  for (const fnName of ['maybeSendSelfWelcomeMessage', 'maybeSendFirstOfferMessage', 'maybeSendActivationNudge']) {
    const fnStart = src.indexOf(`async function ${fnName}(`)
    const fnBody = src.slice(fnStart, fnStart + 3200)
    assert.match(fnBody, /catch \(err\)/, `${fnName} precisa de try/catch próprio`)
  }
  assert.match(src, /maybeSendSelfWelcomeMessage\(\{ phone, sock, hadPhoneBefore: hadPhoneBeforeThisOpen \}\)\.catch\(/)
  assert.match(src, /maybeSendFirstOfferMessage\(\)\.catch\(/)
  assert.match(src, /maybeSendActivationNudge\(\)\.catch\(/)
})

test('a mensagem de 1ª oferta dispara no MESMO onDone que grava first_send_success (previousSuccessCount === 0)', () => {
  const anchor = src.indexOf("if (previousSuccessCount === 0) {")
  assert.notEqual(anchor, -1, 'bloco de previousSuccessCount === 0 não encontrado')
  const block = src.slice(anchor, anchor + 300)
  assert.match(block, /event: 'first_send_success'/)
  assert.match(block, /maybeSendFirstOfferMessage\(\)/)
})

test('o nudge de ativação roda dentro do heartbeat (throttlado), não a cada mensagem', () => {
  assert.match(src, /ACTIVATION_NUDGE_CHECK_INTERVAL_MS/)
  const heartbeatFnStart = src.indexOf('function startHeartbeatIpc()')
  const heartbeatCallIndex = src.indexOf('maybeSendActivationNudge().catch(')
  assert.notEqual(heartbeatFnStart, -1)
  assert.notEqual(heartbeatCallIndex, -1)
  assert.ok(heartbeatCallIndex > heartbeatFnStart, 'a chamada precisa estar dentro do timer do heartbeat')
})

test('emite os 3 sinais na allowlist do analytics', () => {
  const analytics = readFileSync(join(__dirname, '../src/analytics.js'), 'utf8')
  for (const evento of ['ops_self_welcome_message_sent', 'ops_self_first_offer_message_sent', 'ops_self_activation_nudge_sent']) {
    assert.match(src, new RegExp(evento))
    assert.match(analytics, new RegExp(`'${evento}'`))
  }
})
