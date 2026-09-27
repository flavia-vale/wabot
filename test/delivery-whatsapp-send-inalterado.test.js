import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Feature 017 (arquitetura multicanal de entrega), D-A2/R1 do plano:
// sendPreparedPayload (o único ponto que fala com o socket do WhatsApp) foi
// movida de src/bot-worker.js para src/delivery/whatsapp/send.js COM O CORPO
// INALTERADO. Este teste é estrutural (grep de source), no mesmo padrão de
// test/bot-worker-retry-cache-wiring.test.js: falha se alguém "melhorar" o
// caminho do WhatsApp ao extraí-lo, ou depois da extração.
//
// As quatro rotas de envio de hoje, na MESMA ordem: relay -> primary+fallbacks
// -> default (sock.sendMessage cru). Mais: o messageId estável derivado do
// logId, o strip de campos inseguros de canal, e o timeout por tentativa.

const __dirname = dirname(fileURLToPath(import.meta.url))
const sendSourcePath = join(__dirname, '../src/delivery/whatsapp/send.js')
const sendSource = readFileSync(sendSourcePath, 'utf8')
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

test('src/delivery/whatsapp/send.js exporta sendPreparedPayload', () => {
  assert.match(sendSource, /export\s+(async\s+)?function\s+sendPreparedPayload\s*\(/)
})

test('sendPreparedPayload deriva um messageId estável do logId (reaproveitado em todas as rotas)', () => {
  const fnStart = sendSource.indexOf('function sendPreparedPayload')
  assert.notEqual(fnStart, -1, 'sendPreparedPayload não encontrada em send.js')
  const body = sendSource.slice(fnStart)
  assert.match(body, /buildStableSendMessageId\(job\.logId\)/)
})

test('as quatro rotas de envio continuam presentes e na mesma ordem: relay -> primary/fallbacks -> default', () => {
  const fnStart = sendSource.indexOf('function sendPreparedPayload')
  const body = sendSource.slice(fnStart)

  const relayIndex = body.indexOf("payload._route === 'relay'")
  const relayCallIndex = body.indexOf('sock.relayMessage(')
  const primaryIndex = body.indexOf('payload.primary')
  const fallbacksIndex = body.indexOf('payload.fallbacks')
  const defaultSendIndex = body.lastIndexOf('sock.sendMessage(job.destJid, payload, sendOptionsWith())')

  for (const [name, idx] of [
    ['relay guard', relayIndex],
    ['relayMessage call', relayCallIndex],
    ['primary route', primaryIndex],
    ['fallbacks route', fallbacksIndex],
    ['default sendMessage route', defaultSendIndex],
  ]) {
    assert.notEqual(idx, -1, `${name} não encontrada em sendPreparedPayload`)
  }

  assert.ok(relayIndex < relayCallIndex, 'relay guard precisa vir antes da chamada relayMessage')
  assert.ok(relayCallIndex < primaryIndex, 'rota relay precisa vir antes da rota primary/fallbacks')
  assert.ok(primaryIndex < fallbacksIndex, 'rota primary precisa vir antes de considerar fallbacks')
  assert.ok(fallbacksIndex < defaultSendIndex, 'rota primary/fallbacks precisa vir antes do default sendMessage')
})

test('destino canal (@newsletter) tem os campos inseguros removidos antes de qualquer sendMessage', () => {
  const fnStart = sendSource.indexOf('function sendPreparedPayload')
  const body = sendSource.slice(fnStart)
  assert.match(body, /isChannelDestination\(job\.destJid\)/)
  assert.match(body, /stripChannelUnsafeFields\(/)
})

test('toda chamada de envio passa por withSendTimeout, por tentativa', () => {
  const fnStart = sendSource.indexOf('function sendPreparedPayload')
  const body = sendSource.slice(fnStart)
  const withTimeoutCount = (body.match(/withSendTimeout\(/g) || []).length
  assert.ok(withTimeoutCount >= 3, `esperava as 3 chamadas de envio (relay/primary-fallbacks/default) dentro de withSendTimeout, achei ${withTimeoutCount}`)
})

test('bot-worker.js importa sendPreparedPayload do adaptador de WhatsApp, em vez de declará-la localmente', () => {
  assert.match(botWorkerSource, /from ['"]\.\/delivery\/whatsapp\/send\.js['"]/)
  assert.doesNotMatch(botWorkerSource, /async function sendPreparedPayload\(/, 'sendPreparedPayload não pode mais ser declarada dentro de bot-worker.js')
})

test('bot-worker.js continua chamando sendPreparedPayload com os mesmos argumentos', () => {
  assert.match(botWorkerSource, /await sendPreparedPayload\(\{\s*sock:\s*sockForAttempt,\s*job,\s*payload,\s*attempt\s*\}\)/)
})
