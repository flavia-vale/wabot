import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA 2026-09-23 (conta tecnicotelecom10@gmail.com; medido em 63% da frota):
// canal (@newsletter) com sender-key dessincronizada nunca é curado pelo
// refresh de grupo (não é grupo) nem pela quarentena por msgId (cada
// mensagem nova do canal tem um id DIFERENTE — "o mesmo id repetir" nunca
// acontece). Sem correção, toda mensagem nova reabre decrypt-fail ->
// retry-receipt -> stream:error -> queda, pra sempre. Este teste é estrutural
// (grep de source) porque bot-worker.js roda como processo próprio e não
// expõe essa lógica para import direto — mesmo padrão de
// bot-worker-retry-cache-wiring.test.js.

test('desyncedChannelJids é declarado em escopo de módulo (fora de startBotInner)', () => {
  const declIndex = botWorkerSource.indexOf('const desyncedChannelJids = new Map()')
  const startBotInnerIndex = botWorkerSource.indexOf('async function startBotInner()')
  assert.notEqual(declIndex, -1, 'declaração de desyncedChannelJids não encontrada')
  assert.notEqual(startBotInnerIndex, -1, 'startBotInner não encontrada')
  assert.ok(
    declIndex < startBotInnerIndex,
    'desyncedChannelJids precisa ser declarado ANTES/FORA de startBotInner (escopo de módulo), senão o contador zera a cada reconexão e o limiar nunca é cruzado'
  )
})

test('handleGroupDecryptSignal trata @newsletter ANTES de tentar o refresh de grupo', () => {
  const fnStart = botWorkerSource.indexOf('function handleGroupDecryptSignal(args)')
  const fnEnd = botWorkerSource.indexOf('\n// Consultado pelo shouldIgnoreJid', fnStart)
  assert.notEqual(fnStart, -1, 'handleGroupDecryptSignal não encontrada')
  assert.notEqual(fnEnd, -1, 'fim de handleGroupDecryptSignal não encontrado (função vizinha esperada não achada)')
  const body = botWorkerSource.slice(fnStart, fnEnd)
  const newsletterBranch = body.indexOf("jid.endsWith('@newsletter')")
  const groupRefreshCall = body.indexOf('triggerWaGroupsRefresh(')
  assert.notEqual(newsletterBranch, -1, 'ramo de canal (@newsletter) não encontrado em handleGroupDecryptSignal')
  assert.notEqual(groupRefreshCall, -1, 'chamada a triggerWaGroupsRefresh não encontrada')
  assert.ok(
    newsletterBranch < groupRefreshCall,
    'canal precisa ser tratado (e sair da função) ANTES do bloco que dispara o refresh de grupo — refresh de grupo não se aplica a canal'
  )
})

test('canal em quarentena nunca inclui jid na allowlist (fonte monitorada de propósito)', () => {
  const fnStart = botWorkerSource.indexOf('function handleGroupDecryptSignal(args)')
  const fnEnd = botWorkerSource.indexOf('\n// Consultado pelo shouldIgnoreJid', fnStart)
  const body = botWorkerSource.slice(fnStart, fnEnd)
  const allowlistCheck = body.indexOf('allowedChatJids.has(normalizedJid)')
  const setQuarantine = body.indexOf('desyncedChannelJids.set(')
  assert.notEqual(allowlistCheck, -1, 'checagem de allowlist não encontrada no ramo de canal')
  assert.notEqual(setQuarantine, -1, 'gravação da quarentena não encontrada no ramo de canal')
  assert.ok(allowlistCheck < setQuarantine, 'a checagem de allowlist precisa vir ANTES de colocar o canal em quarentena')
})

test('shouldIgnoreJid do socket consulta isChannelDesyncQuarantined', () => {
  const configStart = botWorkerSource.indexOf('shouldIgnoreJid: (jid) => {')
  assert.notEqual(configStart, -1, 'shouldIgnoreJid não encontrado na config do makeWASocket')
  const configEnd = botWorkerSource.indexOf('\n    },', configStart)
  const block = botWorkerSource.slice(configStart, configEnd)
  assert.match(block, /isChannelDesyncQuarantined\(jid\)/, 'shouldIgnoreJid precisa consultar isChannelDesyncQuarantined')
})

test('WA_CHANNEL_DESYNC_QUARANTINE_ENABLED nasce OFF por padrão (nunca deploy sem validação em staging)', () => {
  const declIndex = botWorkerSource.indexOf('const WA_CHANNEL_DESYNC_QUARANTINE_ENABLED =')
  assert.notEqual(declIndex, -1, 'declaração de WA_CHANNEL_DESYNC_QUARANTINE_ENABLED não encontrada')
  const line = botWorkerSource.slice(declIndex, botWorkerSource.indexOf('\n', declIndex))
  assert.match(line, /process\.env\.WA_CHANNEL_DESYNC_QUARANTINE_ENABLED/, 'precisa ler de env (escape hatch / opt-in)')
})
