// RCA 2026-09-28 (docs/rca/whatsapp-sessao.md, "Aguardando mensagem" — parte 4):
// decide com criptografia real (libsignal do Baileys) a hipótese "o Baileys
// 6.7.23 nomeia o sender key do grupo com o número (PN) do robô e o 7.x com o
// LID; com 99% dos membros em @lid, isso explicaria a falha primária".
//
// Resposta: o NOME do sender key é só o rótulo do arquivo local
// (`sender-key-<grupo>::<user>::<device>`). O pacote SKDM que vai no fio leva
// id, iteração e chaves — nenhum endereço. Quem recebe guarda a chave sob o
// `participant` que o SERVIDOR carimba na mensagem. Portanto trocar o nome
// local (PN → LID) não muda nada do que o membro recebe — e, pior, cria uma
// chave NOVA que ninguém tem.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initAuthCreds } from '@whiskeysockets/baileys'
import { makeLibSignalRepository } from '@whiskeysockets/baileys/lib/Signal/libsignal.js'

function memoryKeys() {
  const data = {}
  return {
    async get(type, ids) {
      const out = {}
      for (const id of ids) {
        const v = data[`${type}:${id}`]
        if (v !== undefined) out[id] = v
      }
      return out
    },
    async set(update) {
      for (const [type, byId] of Object.entries(update)) {
        for (const [id, v] of Object.entries(byId || {})) {
          if (v === null) delete data[`${type}:${id}`]
          else data[`${type}:${id}`] = v
        }
      }
    },
    dump() {
      return Object.keys(data)
    },
  }
}

function makeParty() {
  const keys = memoryKeys()
  const auth = { creds: initAuthCreds(), keys }
  return { auth, keys, repo: makeLibSignalRepository(auth) }
}

const GROUP = '120363000000000002@g.us'
const BOT_PN = '5521900000001:7@s.whatsapp.net'
const BOT_LID = '184730000000001:7@lid'

async function deliverSkdm(member, skdmBytes, authorJid) {
  await member.repo.processSenderKeyDistributionMessage({
    item: { groupId: GROUP, axolotlSenderKeyDistributionMessage: skdmBytes },
    authorJid,
  })
}

test('o nome local do sender key (PN ou LID) não muda o que o membro recebe: SKDM criada sob o PN abre sob o LID carimbado pelo servidor', async () => {
  const bot = makeParty()
  const member = makeParty()

  // Robô 6.7.23: chave nomeada com o PN. Servidor carimba `participant` em @lid
  // (grupo em addressing_mode=lid) — o membro guarda a chave sob o LID.
  const first = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_PN, data: Buffer.from('oferta 1') })
  await deliverSkdm(member, first.senderKeyDistributionMessage, BOT_LID)
  const plain1 = await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: first.ciphertext })
  assert.equal(Buffer.from(plain1).toString(), 'oferta 1')

  // Próxima oferta, mesma chave: abre sem SKDM nova.
  const second = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_PN, data: Buffer.from('oferta 2') })
  const plain2 = await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: second.ciphertext })
  assert.equal(Buffer.from(plain2).toString(), 'oferta 2')

  // O robô só tem UM arquivo de sender key, nomeado pelo PN.
  const senderKeyFiles = bot.keys.dump().filter((k) => k.startsWith('sender-key:'))
  assert.equal(senderKeyFiles.length, 1)
  assert.match(senderKeyFiles[0], /5521900000001::7$/)
})

test('trocar o nome local para o LID cria uma chave NOVA: quem tinha a SKDM antiga fica em "Aguardando mensagem"', async () => {
  const bot = makeParty()
  const member = makeParty()

  const first = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_PN, data: Buffer.from('oferta 1') })
  await deliverSkdm(member, first.senderKeyDistributionMessage, BOT_LID)
  await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: first.ciphertext })

  // "Porte" da 7.x (groupSenderIdentity = meLid) sem zerar a sender-key-memory:
  // o robô passa a cifrar com uma chave que o membro nunca recebeu.
  const renamed = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_LID, data: Buffer.from('oferta 2') })
  await assert.rejects(member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: renamed.ciphertext }))
  assert.equal(bot.keys.dump().filter((k) => k.startsWith('sender-key:')).length, 2)

  // Só volta a abrir depois de receber a SKDM da chave nova (pairwise, no reenvio).
  await deliverSkdm(member, renamed.senderKeyDistributionMessage, BOT_LID)
  const third = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_LID, data: Buffer.from('oferta 3') })
  const plain3 = await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: third.ciphertext })
  assert.equal(Buffer.from(plain3).toString(), 'oferta 3')
})

test('sender key perdido no disco (memória do grupo intacta) = chave nova que ninguém tem; o reenvio direto com SKDM recupera', async () => {
  const bot = makeParty()
  const member = makeParty()

  const first = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_PN, data: Buffer.from('oferta 1') })
  await deliverSkdm(member, first.senderKeyDistributionMessage, BOT_LID)
  await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: first.ciphertext })

  // Some o arquivo `sender-key-…` do robô (o `sender-key-memory` continua
  // dizendo que o membro já tem a chave, então nenhuma SKDM nova sai no envio
  // normal). É o mecanismo que deixa TODOS os membros presos de uma vez.
  const [senderKeyId] = bot.keys.dump().filter((k) => k.startsWith('sender-key:')).map((k) => k.slice('sender-key:'.length))
  await bot.keys.set({ 'sender-key': { [senderKeyId]: null } })

  const afterLoss = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_PN, data: Buffer.from('oferta 2') })
  await assert.rejects(member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: afterLoss.ciphertext }))

  // Reenvio (parte 2): a SKDM da chave atual vai embutida, direto ao aparelho.
  const skdm = await bot.repo.getSenderKeyDistributionMessage({ group: GROUP, meId: BOT_PN })
  await deliverSkdm(member, skdm, BOT_LID)
  const next = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT_PN, data: Buffer.from('oferta 3') })
  const plain = await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT_LID, msg: next.ciphertext })
  assert.equal(Buffer.from(plain).toString(), 'oferta 3')
})

test('patch: reenvio pedido pelo PRÓPRIO aparelho do robô em grupo @lid é reconhecido como "eu" (deviceSentMessage)', () => {
  const send = readFileSync(new URL('../node_modules/@whiskeysockets/baileys/lib/Socket/messages-send.js', import.meta.url), 'utf8')
  // Antes: `areJidsSameUser(participant.jid, meId)` comparava LID com PN — o
  // celular da própria cliente (device 0, @lid) nunca batia e recebia o reenvio
  // sem o embrulho deviceSentMessage que os aparelhos da mesma conta esperam.
  assert.match(send, /const isMe = areJidsSameUser\(participant\.jid, isLidUser\(participant\.jid\) \? authState\.creds\.me\?\.lid \|\| meId : meId\);/)
})
