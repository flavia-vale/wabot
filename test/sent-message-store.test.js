import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, utimesSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { proto } from '@whiskeysockets/baileys'
import { createSentMessageStore, toSafeMessageFileName } from '../src/core/sentMessageStore.js'

const encode = (message) => proto.Message.encode(proto.Message.fromObject(message)).finish()
const decode = (bytes) => proto.Message.decode(bytes)

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'sent-msg-store-'))
}

test('guarda e devolve a mensagem enviada (ida e volta pelo protobuf, com thumbnail)', () => {
  const dir = tempDir()
  try {
    const store = createSentMessageStore({ dir, encode, decode })
    const thumb = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01])
    const message = { extendedTextMessage: { text: 'Oferta https://s.shopee.com.br/abc', matchedText: 'https://s.shopee.com.br/abc', jpegThumbnail: thumb } }
    assert.equal(store.save('3EB0ABCDEF0123456789', message), true)
    const loaded = store.load('3EB0ABCDEF0123456789')
    assert.equal(loaded.extendedTextMessage.text, message.extendedTextMessage.text)
    assert.deepEqual(Buffer.from(loaded.extendedTextMessage.jpegThumbnail), thumb)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('id desconhecido devolve undefined (Baileys segue sem reenviar)', () => {
  const dir = tempDir()
  try {
    const store = createSentMessageStore({ dir, encode, decode })
    assert.equal(store.load('NAOEXISTE'), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('id que não é nome de arquivo seguro é recusado (sem path traversal)', () => {
  assert.equal(toSafeMessageFileName('../../etc/passwd'), null)
  assert.equal(toSafeMessageFileName(''), null)
  assert.equal(toSafeMessageFileName(undefined), null)
  assert.equal(toSafeMessageFileName('3EB0ABC'), '3EB0ABC.bin')
  const dir = tempDir()
  try {
    const store = createSentMessageStore({ dir, encode, decode })
    assert.equal(store.save('../fora', { conversation: 'x' }), false)
    assert.equal(store.load('../fora'), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('mensagem mais velha que o TTL não é devolvida e é apagada na limpeza', () => {
  const dir = tempDir()
  try {
    let clock = Date.now()
    const store = createSentMessageStore({ dir, encode, decode, ttlMs: 60_000, now: () => clock })
    store.save('VELHA', { conversation: 'a' })
    const old = new Date(clock - 120_000)
    utimesSync(join(dir, 'VELHA.bin'), old, old)
    assert.equal(store.load('VELHA'), undefined)
    const { removed } = store.prune()
    assert.equal(removed, 1)
    assert.deepEqual(readdirSync(dir), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('teto de arquivos: a limpeza apaga as mais antigas e mantém as recentes', () => {
  const dir = tempDir()
  try {
    const store = createSentMessageStore({ dir, encode, decode, maxEntries: 2, pruneEveryWrites: 1000 })
    const base = Date.now() - 10_000
    for (let i = 0; i < 4; i++) {
      store.save(`MSG${i}`, { conversation: String(i) })
      const t = new Date(base + i * 1000)
      utimesSync(join(dir, `MSG${i}.bin`), t, t)
    }
    store.prune()
    assert.deepEqual(readdirSync(dir).sort(), ['MSG2.bin', 'MSG3.bin'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('falha de disco não lança (envio nunca quebra por causa do armazenamento)', () => {
  // Um ARQUIVO no lugar da pasta: mkdir falha com ENOTDIR/EEXIST.
  const dir = tempDir()
  try {
    const blocker = join(dir, 'arquivo')
    writeFileSync(blocker, 'x')
    const store = createSentMessageStore({ dir: join(blocker, 'sent'), encode, decode, logger: { warn() {} } })
    assert.equal(store.save('3EB0X', { conversation: 'x' }), false)
    assert.equal(store.load('3EB0X'), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// Estrutural (bot-worker.js roda como processo próprio): sem `getMessage` no
// makeWASocket, o Baileys usa o default que devolve undefined e todo pedido de
// reenvio morre em silêncio — o membro fica em "Aguardando mensagem" para sempre.
const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

test('bot-worker passa getMessage ao makeWASocket e guarda o que envia', () => {
  const socketStart = botWorkerSource.indexOf('const sock = makeWASocket({')
  assert.notEqual(socketStart, -1)
  const socketConfig = botWorkerSource.slice(socketStart, botWorkerSource.indexOf('\n  })\n', socketStart))
  assert.match(socketConfig, /getMessage: getSentMessageForRetry/)
  assert.match(botWorkerSource, /socket\.relayMessage = async \(jid, message, opts\) => \{[\s\S]*?rememberSentMessage\(msgId, message\)/)
  assert.match(botWorkerSource, /type !== 'append'[\s\S]*?rememberSentMessage\(msg\.key\.id, msg\.message\)/)
  const attachIndex = botWorkerSource.indexOf('attachSentMessageRecorder(sock)')
  assert.ok(attachIndex > socketStart, 'o gravador precisa ser ligado em cada socket novo')
})

test('sentMessageStore é criado em escopo de módulo (sobrevive a reconexões)', () => {
  const declIndex = botWorkerSource.indexOf('const sentMessageStore = createSentMessageStore(')
  const startBotInnerIndex = botWorkerSource.indexOf('async function startBotInner()')
  assert.notEqual(declIndex, -1)
  assert.notEqual(startBotInnerIndex, -1)
  assert.ok(declIndex < startBotInnerIndex)
})
