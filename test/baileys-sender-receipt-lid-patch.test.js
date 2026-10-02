import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// RCA 2026-10-02 — contas gabrielpontes@consultorfin.com e glauciasimoes10@gmail.com
// cegas, com queda 500 a cada ~50 min. Medido no bot.log (pid da conta):
//   14:36:01.494  chegada da DM de outro aparelho da conta (from 60155429409001:39@lid,
//                 recipient 78765438816421@lid), decifrada sem erro
//   14:36:01.497  "DM de outro aparelho da conta confirmada com receipt" type=sender,
//                 SEM participant
//   15:26:00.517  <stream:error><ack class=message id=<mesmo id>/></stream:error> -> 500
// O Baileys 6.7 só preenche participant (= aparelho autor) no <receipt type=sender>
// quando o chat é jid de telefone; em LID o receipt sai sem ele e o servidor espera
// o ack por 50 min. O 7.x (7.0.0-rc14) usa isLidUser nesse ponto. O patch espelha.

const require = createRequire(import.meta.url)
const recv = readFileSync(require.resolve('@whiskeysockets/baileys/lib/Socket/messages-recv.js'), 'utf8')

const senderBranch = (() => {
  const start = recv.indexOf("type = 'sender';")
  assert.ok(start > 0, "ramo do receipt type=sender não encontrado em handleMessage")
  const end = recv.indexOf('else if (!sendActiveReceipts)', start)
  assert.ok(end > start)
  return recv.slice(start, end)
})()

test('DM de outro aparelho da conta em LID leva o aparelho autor como participant', () => {
  assert.match(
    senderBranch,
    /if \(isJidUser\(msg\.key\.remoteJid\) \|\| isLidUser\(msg\.key\.remoteJid\)\) \{\s*participant = author;/,
    'patch não aplicado: receipt type=sender em LID sai sem participant (rode `npx patch-package`)',
  )
})

test('grupo continua com o participant original da mensagem', () => {
  assert.doesNotMatch(senderBranch, /isJidGroup/)
})
