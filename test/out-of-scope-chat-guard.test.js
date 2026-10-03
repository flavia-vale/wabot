import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  shouldIgnoreOwnDeviceDm,
  isChatQuarantinable,
  createRecentInboundIndex,
  createChatDropQuarantine,
} from '../src/core/outOfScopeChatGuard.js'
import { buildAllowedJidSet } from '../src/core/ignoredJidPolicy.js'

// RCA 2026-10-02 (gabrielpontes@consultorfin.com): DM de outro aparelho da conta
// (from 60155429409001:39@lid, recipient 78765438816421@lid) derrubava a sessão
// com 500 a cada ~50 min, um id novo por queda, e a conta ficou cega.

const allowed = buildAllowedJidSet(['120363000000000001@g.us', '120363000000000002@newsletter', '5511999990000@s.whatsapp.net'])
const self = buildAllowedJidSet(['60155429409001@lid', '5511988887777@s.whatsapp.net'])

test('A: DM de outro aparelho para contato fora da lista é descartada', () => {
  assert.equal(shouldIgnoreOwnDeviceDm('78765438816421@lid', { enabled: true, ready: true, allowedJids: allowed }), true)
})

test('A: falha para DEIXAR PASSAR (desligada, lista não carregada, jid vazio, contato na lista)', () => {
  assert.equal(shouldIgnoreOwnDeviceDm('78765438816421@lid', { enabled: false, ready: true, allowedJids: allowed }), false)
  assert.equal(shouldIgnoreOwnDeviceDm('78765438816421@lid', { enabled: true, ready: false, allowedJids: allowed }), false)
  assert.equal(shouldIgnoreOwnDeviceDm('', { enabled: true, ready: true, allowedJids: allowed }), false)
  assert.equal(shouldIgnoreOwnDeviceDm('5511999990000:3@s.whatsapp.net', { enabled: true, ready: true, allowedJids: allowed }), false)
})

test('B: nunca põe em quarentena fonte/destino, a própria conta ou status', () => {
  const opts = { ready: true, allowedJids: allowed, selfJids: self }
  assert.equal(isChatQuarantinable('5511999990000:3@s.whatsapp.net', opts), false)
  assert.equal(isChatQuarantinable('60155429409001:39@lid', opts), false)
  assert.equal(isChatQuarantinable('status@broadcast', opts), false)
  assert.equal(isChatQuarantinable('', opts), false)
  assert.equal(isChatQuarantinable('78765438816421@lid', opts), true)
  assert.equal(isChatQuarantinable('5511977776666@s.whatsapp.net', opts), true)
})

test('B: NUNCA grupo nem canal — nem fora da lista (grupo monitorado não pode sair do ar em silêncio)', () => {
  const opts = { ready: true, allowedJids: allowed, selfJids: self }
  assert.equal(isChatQuarantinable('120363000000000001@g.us', opts), false)
  assert.equal(isChatQuarantinable('120363999999999999@g.us', opts), false)
  assert.equal(isChatQuarantinable('120363000000000002@newsletter', opts), false)
  assert.equal(isChatQuarantinable('120363999999999998@newsletter', opts), false)
})

test('B: lista de escolhidos ainda não carregada → nada entra nem fica em quarentena', () => {
  assert.equal(isChatQuarantinable('78765438816421@lid', { ready: false, allowedJids: new Set(), selfJids: self }), false)
})

test('índice id → chat é limitado e devolve o chat da mensagem', () => {
  const index = createRecentInboundIndex({ max: 2 })
  index.record('3EB0A', '78765438816421@lid')
  index.record('3EB0B', '1@lid')
  index.record('3EB0C', '2@lid')
  assert.equal(index.size, 2)
  assert.equal(index.get('3EB0A'), undefined)
  assert.equal(index.get('3EB0C'), '2@lid')
})

test('B: 2 quedas na janela → quarentena durável que sobrevive a restart e expira no TTL', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'chat-drop-')), 'chat-drop-quarantine.json')
  let now = 1_000_000
  const q = createChatDropQuarantine({ file, now: () => now, windowMs: 60_000, threshold: 2, ttlMs: 10_000_000 })
  assert.deepEqual(q.registerDrop('78765438816421@lid'), { count: 1, quarantined: false, newlyQuarantined: false })
  assert.equal(q.isQuarantined('78765438816421@lid'), false)
  now += 50 * 60_000 / 100
  assert.deepEqual(q.registerDrop('78765438816421:0@lid'), { count: 2, quarantined: true, newlyQuarantined: true })
  assert.equal(q.isQuarantined('78765438816421@lid'), true)
  assert.match(readFileSync(file, 'utf8'), /78765438816421@lid/)

  const reloaded = createChatDropQuarantine({ file, now: () => now, ttlMs: 10_000_000 })
  assert.equal(reloaded.isQuarantined('78765438816421@lid'), true)
  now += 10_000_001
  assert.equal(reloaded.isQuarantined('78765438816421@lid'), false)
})

test('B: quedas fora da janela não somam', () => {
  let now = 0
  const q = createChatDropQuarantine({ now: () => now, windowMs: 60_000, threshold: 2 })
  q.registerDrop('1@lid')
  now += 60_001
  assert.equal(q.registerDrop('1@lid').quarantined, false)
})

// Patch do Baileys: o gancho A roda ANTES de abrir a mensagem e só para DM de
// contato vinda da própria conta; o aviso de chat roda para toda mensagem.
const require = createRequire(import.meta.url)
const recv = readFileSync(require.resolve('@whiskeysockets/baileys/lib/Socket/messages-recv.js'), 'utf8')
const handleMessage = recv.slice(recv.indexOf('const handleMessage = async (node) => {'))

test('patch: DM fora do escopo é confirmada com <ack> antes do decrypt', () => {
  const idxHook = handleMessage.indexOf('shouldIgnoreOwnDeviceDm?.(ownDeviceDmRecipient)')
  const idxDecrypt = handleMessage.indexOf('decryptMessageNode(')
  assert.ok(idxHook > 0, 'patch não aplicado: falta o gancho shouldIgnoreOwnDeviceDm (rode `npx patch-package`)')
  assert.ok(idxDecrypt > idxHook)
  const branch = handleMessage.slice(idxHook, handleMessage.indexOf('return;', idxHook))
  assert.match(branch, /await sendMessageAck\(node\);/)
  assert.match(branch, /wabot: DM de outro aparelho da conta fora do escopo confirmada com ack, sem abrir/)
})

test('patch: só DM de contato — nunca grupo, canal, status, a própria conta ou mensagem interna', () => {
  const block = handleMessage.slice(0, handleMessage.indexOf('shouldIgnoreOwnDeviceDm?.('))
  assert.match(block, /!isJidGroup\(node\.attrs\.from\) && !isJidNewsletter\(node\.attrs\.from\) && !isJidStatusBroadcast\(node\.attrs\.from\)/)
  assert.match(block, /if \(isMe\(node\.attrs\.from\)\)/)
  assert.match(block, /recipient && \(isJidUser\(recipient\) \|\| isLidUser\(recipient\)\) && !isMe\(recipient\)/)
  // Censo de entrada (RCA 2026-10-03): o gancho leva também `offline` e o tipo de
  // cifra. Continua ANTES de qualquer decisão (ignore/ack/decrypt) e sem mudar fluxo.
  assert.match(block, /onIncomingMessageNode\?\.\(\{\s*id: node\.attrs\.id,\s*chatJid: ownDeviceDmRecipient \|\| node\.attrs\.from,\s*offline: !!node\.attrs\.offline,\s*encType: getBinaryNodeChild\(node, 'enc'\)\?\.attrs\?\.type \|\| null\s*\}\)/)
})

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('worker: ganchos passados ao socket e quarentena por chat ligada à queda 500', () => {
  assert.match(worker, /shouldIgnoreOwnDeviceDm: \(recipient\) =>/)
  assert.match(worker, /onIncomingMessageNode: \(\{ id, chatJid, offline, encType \}\) => noteInboundNode\(\{ id, chatJid, offline, encType \}\)/)
  assert.match(worker, /function noteInboundNode\(\{ id, chatJid, offline, encType \}\) \{\s*recentInboundChats\.record\(id, chatJid\)/)
  assert.match(worker, /recentInboundChats\.get\(stuckMsgId\)/)
  assert.match(worker, /chatDropQuarantine\.isQuarantined\(jid\)/)
  // Toda checagem da regra B passa pela lista carregada (ready).
  assert.equal((worker.match(/isChatQuarantinable\(/g) || []).length, (worker.match(/isChatQuarantinable\([^)]*ready: allowedChatJidsReady/g) || []).length)
  // Escopo de módulo: precisa sobreviver a reconexões (mesma lição do msgRetryCounterCache).
  const startInner = worker.indexOf('async function startBotInner')
  assert.ok(startInner > 0)
  assert.ok(worker.indexOf('const recentInboundChats = createRecentInboundIndex') < startInner)
  assert.ok(worker.indexOf('const chatDropQuarantine = createChatDropQuarantine') < startInner)
})
