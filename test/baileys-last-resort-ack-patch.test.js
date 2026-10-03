import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Defesa genérica contra quedas 500 por mensagem sem resposta (docs/rca/
// whatsapp-sessao.md "Ack de último recurso"). O Baileys 6.7.23 tinha caminhos
// em que uma mensagem recebida saía de handleMessage sem ack, receipt nem
// retry-receipt — o servidor reentrega a cada reconexão:
//   E9  exceção em handleMessage → só loga 'error in handling message'
//   E7  unavailable COM enc que não decifra → return sem ack no retryMutex
//   E8  status@broadcast que não decifra → retry-receipt recusado (500)
//   E11 exceção num node da fila offline matava o dreno (isProcessing preso)
// O 7.x faz sendMessageAck(node, UnhandledError) no catch; portado aqui.

const require = createRequire(import.meta.url)
const recv = readFileSync(require.resolve('@whiskeysockets/baileys/lib/Socket/messages-recv.js'), 'utf8')
const patch = readFileSync(new URL('../patches/@whiskeysockets+baileys+6.7.23.patch', import.meta.url), 'utf8')

const failureBranch = (() => {
  const start = recv.indexOf('if (msg.messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT) {')
  const end = recv.indexOf('else if (isJidNewsletter(msg.key.remoteJid))', start)
  assert.ok(start > 0 && end > start, 'ramo de falha de decrypt não encontrado (rode `npx patch-package`)')
  return recv.slice(start, end)
})()

test('o patch versionado contém as mudanças (não só o node_modules local)', () => {
  for (const marca of [
    'respondedMessageNodes',
    'handleMessageGuarded',
    'nackUnansweredMessage',
    'wabot: status sem decifrar confirmado com nack, sem retry',
    'wabot: unavailable com enc sem decifrar confirmado com nack',
    "onUnexpectedError(error, 'processing offline node')",
  ]) assert.ok(patch.includes(marca), `patch sem: ${marca}`)
})

test('sendMessageAck marca o node como respondido', () => {
  const m = recv.match(/const sendMessageAck = async \(node, errorCode\) => \{\s*const \{ tag, attrs, content \} = node;\s*respondedMessageNodes\.add\(node\);/)
  assert.ok(m, 'sendMessageAck precisa registrar o node respondido')
})

test('E9: exceção em handleMessage termina em nack UnhandledError, só se nada foi respondido', () => {
  const fn = recv.slice(recv.indexOf('const nackUnansweredMessage = async'), recv.indexOf('const handleMessageGuarded = async'))
  assert.match(fn, /if \(respondedMessageNodes\.has\(node\)\) \{\s*return;/)
  assert.match(fn, /sendMessageAck\(node, NACK_REASONS\.UnhandledError\)/)
  assert.match(fn, /catch \(ackError\)/, 'falha do próprio nack não pode propagar')
  const innerCatch = recv.match(/'error in handling message'\);\s*await nackUnansweredMessage\(node, error\);/g)
  assert.equal(innerCatch?.length, 2, 'catch interno e o guard externo chamam o nack')
})

test('E9: as duas entradas de mensagem usam o guard (online e fila offline)', () => {
  assert.match(recv, /\['message', handleMessageGuarded\]/)
  assert.match(recv, /processNode\('message', node, 'processing message', handleMessageGuarded\)/)
  assert.doesNotMatch(recv, /\['message', handleMessage\]/)
})

test('receipt e retry-receipt contam como resposta (sem nack duplicado)', () => {
  assert.match(recv, /await sendReceipt\(msg\.key\.remoteJid, participant, \[msg\.key\.id\], type\);\s*respondedMessageNodes\.add\(node\);/)
  assert.match(failureBranch, /respondedMessageNodes\.add\(node\);\s*retryMutex\.mutex\(/)
})

test('E7: unavailable com enc que não decifra recebe nack 500; sem enc não duplica', () => {
  const m = failureBranch.match(/if \(getBinaryNodeChild\(node, 'unavailable'\)\) \{[\s\S]*?return;\s*\}/)
  assert.ok(m)
  assert.match(m[0], /if \(getBinaryNodeChild\(node, 'enc'\)\) \{\s*await sendMessageAck\(node, NACK_REASONS\.UnhandledError\);/)
})

test('E8: status que não decifra é confirmado com nack 500 antes do retry; grupo segue no retry', () => {
  const idxDm = failureBranch.indexOf('isJidUser(msg.key.remoteJid)')
  const idxStatus = failureBranch.indexOf('if (isJidStatusBroadcast(msg.key.remoteJid)) {')
  const idxRetry = failureBranch.indexOf('retryMutex.mutex(')
  assert.ok(idxDm > 0 && idxStatus > idxDm && idxRetry > idxStatus)
  const statusBranch = failureBranch.slice(idxStatus, failureBranch.indexOf('return;', idxStatus))
  assert.match(statusBranch, /await sendMessageAck\(node, NACK_REASONS\.UnhandledError\);/)
  assert.doesNotMatch(statusBranch, /isJidGroup|isJidNewsletter|sendRetryRequest/)
  assert.match(failureBranch, /sendRetryRequest\(node, !encNode\)/, 'o retry de grupo precisa continuar existindo')
})

test('E11: exceção num node não mata o dreno da fila offline', () => {
  const m = recv.match(/while \(nodes\.length && ws\.isOpen\) \{[\s\S]*?isProcessing = false;/)
  assert.ok(m)
  assert.match(m[0], /try \{\s*await nodeProcessor\(node\);\s*\}\s*catch \(error\) \{\s*onUnexpectedError\(error, 'processing offline node'\);/)
})
