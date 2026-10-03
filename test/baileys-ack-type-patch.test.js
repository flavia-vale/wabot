import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// RCA 2026-10-03 (doritosmms@gmail.com, conectada e cega). Medido no bot.log do
// pid da conta, em 3 h: 225 nós de mensagem, TODOS cópia fromMe do celular da
// cliente (ids `3A…`, iPhone) para a Meta AI (`recipient` …@bot); 15 ids
// distintos, cada um reentregue 5× em 8 s por conexão; nenhum "handled N
// offline messages" (a fila offline nunca fechou); 0 upsert, 0 grupo; e a cada
// ~50 min `<stream:error><ack class=message type=text id=…/></stream:error>`.
// O 6.7.23 só punha `type` no <ack> de mensagem em erro/unavailable; o ack que o
// servidor devolve como "esperado" traz `type`. O WA Web sempre manda `type` e
// `from` em ack de mensagem; o Baileys 7.x (Utils/stanza-ack.js) também.

const require = createRequire(import.meta.url)
const recv = readFileSync(require.resolve('@whiskeysockets/baileys/lib/Socket/messages-recv.js'), 'utf8')
const patch = readFileSync(new URL('../patches/@whiskeysockets+baileys+6.7.23.patch', import.meta.url), 'utf8')

const ackBuilder = (() => {
  const start = recv.indexOf('const sendMessageAck = async (node, errorCode) => {')
  const end = recv.indexOf("'sent ack'", start)
  assert.ok(start > 0 && end > start, 'sendMessageAck não encontrado (rode `npx patch-package`)')
  return recv.slice(start, end)
})()

test('o <ack> de mensagem leva `type` sempre que o nó recebido tem `type`', () => {
  assert.match(ackBuilder, /if \(!!attrs\.type\) \{\s*stanza\.attrs\.type = attrs\.type;\s*\}/)
  // A condição antiga (type só em erro/unavailable) não pode voltar.
  assert.doesNotMatch(ackBuilder, /errorCode !== 0\)\) \{\s*stanza\.attrs\.type/)
})

test('o <ack> de mensagem leva `from` = a própria conta, como o WA Web', () => {
  assert.match(ackBuilder, /if \(tag === 'message' && authState\.creds\.me\?\.id\) \{\s*stanza\.attrs\.from = authState\.creds\.me\.id;/)
})

test('cópia fromMe para a Meta AI (@bot) entra na regra A (ack antes de abrir)', () => {
  assert.match(recv, /recipient && \(isJidUser\(recipient\) \|\| isLidUser\(recipient\) \|\| isJidMetaIa\(recipient\)\) && !isMe\(recipient\)/)
  assert.match(recv, /import \{[^}]*isJidMetaIa[^}]*\} from '\.\.\/WABinary\/index\.js'/)
})

test('o patch versionado contém as mudanças (não só o node_modules local)', () => {
  for (const marca of [
    'if (!!attrs.type) {',
    "if (tag === 'message' && authState.creds.me?.id) {",
    'isLidUser(recipient) || isJidMetaIa(recipient)',
  ]) assert.ok(patch.includes(marca), `patch sem: ${marca}`)
})

// RCA 2026-10-03 (medido depois do ack com type): o servidor seguiu reentregando a
// cópia para a Meta AI 4-5× por conexão e a fila offline nunca fechou. Para
// <message>, resposta válida é <receipt> ou nack; o 7.x responde nack 500 a
// mensagem ignorada e nack 495 a msmsg. Nenhum caminho de descarte de <message>
// pode voltar a mandar ack de sucesso (exceto canal e unavailable sem enc, que o
// 7.x também confirma com ack).
test('mensagem ignorada por shouldIgnoreJid leva nack 500; msmsg leva nack 495', () => {
  assert.match(recv, /'ignored message'\);[\s\S]{0,400}?await sendMessageAck\(node, NACK_REASONS\.UnhandledError\);/)
  assert.match(recv, /'ignored msmsg'\);[\s\S]{0,300}?await sendMessageAck\(node, NACK_REASONS\.MissingMessageSecret\);/)
})

test('só canal e unavailable-sem-enc continuam com ack de sucesso dentro de handleMessage', () => {
  const start = recv.indexOf('const handleMessage = async (node) => {')
  const end = recv.indexOf('const nackUnansweredMessage', start)
  const body = recv.slice(start, end)
  const sucessos = body.match(/await sendMessageAck\(node\);/g) || []
  assert.equal(sucessos.length, 2, `ack de sucesso para <message> só no canal e no unavailable sem enc; achei ${sucessos.length}`)
})
