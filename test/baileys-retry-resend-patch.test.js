// RCA 2026-09-28 (docs/rca/whatsapp-sessao.md, "Aguardando mensagem" — parte 2):
// o reenvio de mensagem de GRUPO precisa ir cifrado direto para o aparelho que
// pediu, com a chave do grupo (SKDM) embutida, montando a sessão com as chaves
// que vieram dentro do próprio pedido. Este teste roda a criptografia de verdade
// (libsignal do Baileys, patch aplicado) nos dois lados: robô e membro.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initAuthCreds, xmppPreKey, xmppSignedPreKey, encodeBigEndian, KEY_BUNDLE_TYPE, getNextPreKeys, proto } from '@whiskeysockets/baileys'
import { makeLibSignalRepository } from '@whiskeysockets/baileys/lib/Signal/libsignal.js'
import { extractE2ESessionFromRetryReceipt } from '@whiskeysockets/baileys/lib/Utils/signal.js'

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
  }
}

function makeParty() {
  const auth = { creds: initAuthCreds(), keys: memoryKeys() }
  return { auth, repo: makeLibSignalRepository(auth) }
}

// Mesmo formato que o Baileys (sendRetryRequest) e o WhatsApp montam o pedido
// de reenvio a partir da 2ª tentativa: registration + <keys> com identidade,
// pre-key e signed pre-key do aparelho que pediu.
async function buildRetryReceipt(member, groupJid, msgId) {
  const { preKeys } = await getNextPreKeys(member.auth, 1)
  const [keyId] = Object.keys(preKeys)
  const { creds } = member.auth
  return {
    tag: 'receipt',
    attrs: { id: msgId, type: 'retry', to: groupJid },
    content: [
      { tag: 'retry', attrs: { count: '2', id: msgId, v: '1' } },
      { tag: 'registration', attrs: {}, content: encodeBigEndian(creds.registrationId) },
      {
        tag: 'keys',
        attrs: {},
        content: [
          { tag: 'type', attrs: {}, content: Buffer.from(KEY_BUNDLE_TYPE) },
          { tag: 'identity', attrs: {}, content: creds.signedIdentityKey.public },
          xmppPreKey(preKeys[+keyId], +keyId),
          xmppSignedPreKey(creds.signedPreKey),
        ],
      },
    ],
  }
}

const GROUP = '120363000000000001@g.us'
const BOT = '5521900000001:7@s.whatsapp.net'
const MEMBER = '99887766554433:2@lid'

test('membro que não abriu a mensagem de grupo abre o reenvio e as mensagens seguintes', async () => {
  const bot = makeParty()
  const member = makeParty()

  // 1) Envio normal no grupo: o membro NÃO recebeu a chave do grupo (é o caso
  //    "Aguardando mensagem") — não consegue decifrar.
  const first = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT, data: Buffer.from('oferta 1') })
  await assert.rejects(member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT, msg: first.ciphertext }))

  // 2) O aparelho do membro pede reenvio mandando as próprias chaves.
  const receipt = await buildRetryReceipt(member, GROUP, 'MSG1')
  const bundle = extractE2ESessionFromRetryReceipt(receipt)
  assert.ok(bundle, 'o pacote de chaves do pedido precisa ser lido')
  assert.equal(bundle.registrationId, member.auth.creds.registrationId)

  // 3) Robô (patch): sessão montada com o pacote do pedido + mensagem cifrada
  //    direto para o aparelho, com a chave do grupo embutida.
  await bot.repo.injectE2ESession({ jid: MEMBER, session: bundle })
  const skdm = await bot.repo.getSenderKeyDistributionMessage({ group: GROUP, meId: BOT })
  const resent = {
    conversation: 'oferta 1',
    senderKeyDistributionMessage: { groupId: GROUP, axolotlSenderKeyDistributionMessage: skdm },
  }
  const { type, ciphertext } = await bot.repo.encryptMessage({ jid: MEMBER, data: proto.Message.encode(resent).finish() })
  assert.equal(type, 'pkmsg')

  // 4) Membro abre o reenvio (não fica mais em "Aguardando mensagem")…
  const plain = await member.repo.decryptMessage({ jid: BOT, type, ciphertext })
  const decoded = proto.Message.decode(plain)
  assert.equal(decoded.conversation, 'oferta 1')

  // 5) …e, com a chave do grupo que veio junto, abre as PRÓXIMAS ofertas do grupo.
  await member.repo.processSenderKeyDistributionMessage({ item: decoded.senderKeyDistributionMessage, authorJid: BOT })
  const next = await bot.repo.encryptGroupMessage({ group: GROUP, meId: BOT, data: Buffer.from('oferta 2') })
  const nextPlain = await member.repo.decryptGroupMessage({ group: GROUP, authorJid: BOT, msg: next.ciphertext })
  assert.equal(Buffer.from(nextPlain).toString(), 'oferta 2')
})

test('pedido sem pacote de chaves (1ª tentativa) devolve null — cai na busca no servidor', () => {
  assert.equal(extractE2ESessionFromRetryReceipt({ tag: 'receipt', attrs: {}, content: [] }), null)
})

test('patch do reenvio está no pacote instalado (node_modules)', () => {
  const send = readFileSync(new URL('../node_modules/@whiskeysockets/baileys/lib/Socket/messages-send.js', import.meta.url), 'utf8')
  const recv = readFileSync(new URL('../node_modules/@whiskeysockets/baileys/lib/Socket/messages-recv.js', import.meta.url), 'utf8')
  assert.match(send, /if \(\(isGroup \|\| isStatus\) && participant\) \{/)
  assert.match(send, /count: String\(participant\.count \|\| 1\)/)
  assert.match(send, /shouldIncludeDeviceIdentity = true;/)
  assert.match(recv, /extractE2ESessionFromRetryReceipt\(receiptNode\)/)
  assert.match(recv, /await sendMessagesAgain\(key, ids, retryNode, node\);/)
})
