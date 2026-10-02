import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// RCA 2026-10-01 — conta glauciasimoes10@gmail.com cega (espelhava 31× em 7 dias
// e passou a 0, "conectada" o tempo todo). Medido no bot.log: 236 de 236 mensagens
// drenadas da fila offline no boot vinham de `9252148089054:14@lid` — OUTRO
// aparelho da própria conta, mandando DMs (`fromMe`, `@lid`) que o robô não
// decifra. As quedas 500 carregavam `stuckMsgId` dessas DMs.
//
// ⚠️ Correção do RCA: o `MessageCounterError` dessas DMs ("Key used already or
// never filled" == MISSING_KEYS_ERROR_TEXT) cai no ramo ANTERIOR do Baileys
// (`sendMessageAck(node, 487)`), não no ramo de DM deste patch. O ramo de DM só
// age em OUTROS erros de decrypt (Bad MAC, No session...), e foi medido agindo na
// frota. A causa da queda da conta dela NÃO está provada; o patch ganhou LOGS
// (sem mudar comportamento) para provar o mecanismo na próxima queda.
//
// Conserto do ramo de DM (patch no Baileys 6.7.23): DM (jid de usuário ou LID)
// que não abre por outro erro é confirmada com <ack> e descartada, SEM pedir
// reenvio. Grupo, canal e status seguem o caminho original. Estes testes travam
// o escopo: se ele alargar para grupo, a falha de chave de grupo deixa de ser
// curada pelo retry.

const require = createRequire(import.meta.url)
const recv = readFileSync(require.resolve('@whiskeysockets/baileys/lib/Socket/messages-recv.js'), 'utf8')
const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

const failureBranch = (() => {
  const start = recv.indexOf('if (msg.messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT) {')
  assert.ok(start > 0, 'ramo de falha de decrypt não encontrado em handleMessage')
  const end = recv.indexOf('else if (isJidNewsletter(msg.key.remoteJid))', start)
  assert.ok(end > start)
  return recv.slice(start, end)
})()

const dmBranch = (() => {
  const m = failureBranch.match(/if \(isJidUser\(msg\.key\.remoteJid\) \|\| isLidUser\(msg\.key\.remoteJid\)\) \{[\s\S]*?\n\s*\}\n/)
  assert.ok(m, 'patch não aplicado: falta o ramo de DM sem decifrar (rode `npx patch-package`)')
  return m[0]
})()

test('DM que não abre é confirmada com <ack>, sem retry e sem receipt', () => {
  assert.match(dmBranch, /await sendMessageAck\(node\);/)
  assert.match(dmBranch, /return;/)
  assert.doesNotMatch(dmBranch, /sendRetryRequest|sendReceipt\(|retryMutex/)
  assert.match(dmBranch, /wabot: DM sem decifrar confirmada com ack, sem retry/, 'o log é a medição de aceite (grep -c no bot.log)')
})

test('o ramo de DM vem ANTES do pedido de reenvio e depois do nack de chaves ausentes', () => {
  const idxMissing = failureBranch.indexOf('MISSING_KEYS_ERROR_TEXT')
  const idxDm = failureBranch.indexOf('isJidUser(msg.key.remoteJid)')
  const idxRetry = failureBranch.indexOf('retryMutex.mutex(')
  assert.ok(idxMissing >= 0 && idxDm > idxMissing && idxRetry > idxDm)
})

test('o escopo NÃO inclui grupo, canal nem status (esses continuam pedindo reenvio)', () => {
  assert.doesNotMatch(dmBranch, /isJidGroup|isJidNewsletter|isJidStatusBroadcast|@g\.us/)
  assert.match(failureBranch, /retryMutex\.mutex\(async \(\) => \{[\s\S]*sendRetryRequest\(node, !encNode\)/, 'o retry de grupo precisa continuar existindo')
})

test('o worker continua espelhando mensagem fromMe de grupo MONITORADO (a dona posta a oferta na origem)', () => {
  const m = worker.match(/if \(msg\.key\.fromMe\) \{[\s\S]*?if \(!isMonitoredSource\) continue/)
  assert.ok(m, 'o ramo fromMe do worker mudou — a dona perderia a postagem manual na origem')
  assert.match(m[0], /selfCfg\?\.groups\?\.monitor\?\.some/)
})

// --- Instrumentação (só log): provar o mecanismo da queda 500 na próxima ocorrência.
test('a chegada de mensagem de outro aparelho da conta é registrada ANTES de qualquer ack/ignore', () => {
  const idxHandle = recv.indexOf('const handleMessage = async (node) => {')
  const idxLog = recv.indexOf("'wabot: mensagem de outro aparelho da conta chegou ao socket'")
  const idxIgnore = recv.indexOf('if (shouldIgnoreJid(node.attrs.from)', idxHandle)
  assert.ok(idxHandle > 0 && idxLog > idxHandle && idxLog < idxIgnore, 'o log de chegada precisa vir antes de qualquer ack/ignore')
  // RCA 2026-10-02: depois do log entra a blindagem A (DM de outro aparelho fora do
  // escopo -> ack sem abrir, test/out-of-scope-chat-guard.test.js). Até o log, nada
  // pode confirmar nem retornar.
  const bloco = recv.slice(idxHandle, idxLog)
  assert.match(bloco, /areJidsSameUser\(jid, meId\)/)
  assert.match(bloco, /areJidsSameUser\(jid, meLid\)/)
  assert.doesNotMatch(bloco, /sendMessageAck|sendReceipt|return;|await /, 'o log de chegada não pode vir depois de uma decisão')
  assert.match(recv.slice(idxLog - 400, idxLog + 400), /offline: node\.attrs\.offline/)
})

test('só LOG: o nack de MISSING_KEYS e o receipt de DM de outro aparelho continuam sendo enviados, agora registrados', () => {
  assert.match(failureBranch, /logger\.info\([^)]*'wabot: mensagem sem chave confirmada com nack'\);\s*return sendMessageAck\(node, NACK_REASONS\.ParsingError\);/)
  assert.match(recv, /logger\.info\(\{ id: msg\.key\.id, type, participant \}, 'wabot: DM de outro aparelho da conta confirmada com receipt'\);\s*\}\s*await sendReceipt\(msg\.key\.remoteJid, participant, \[msg\.key\.id\], type\);/)
})
