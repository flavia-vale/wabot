import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  INCOMING_ACCEPT_REASON,
  INCOMING_DROP_REASON,
  INCOMING_LATE_MAX_AGE_MS,
  INCOMING_MAX_AGE_MS,
  shouldProcessIncomingMessage,
} from '../src/core/incomingFreshness.js'
import {
  MAX_SEEN_INCOMING_IDS,
  hasSeenIncomingId,
  pruneDedupStore,
  rememberSeenIncomingId,
} from '../src/messageDedup.js'

// RCA 2026-09-24 (frota): as sessões caem com 500 ~1×/hora e as mensagens
// publicadas durante a queda chegam 27–58 min depois — o portão de 5 min as
// jogava fora (196 descartes de 10–60 min em 60 MB de log, 47 robôs). Decisão
// da dona do produto: até 60 min passa, se for de origem monitorada e o id
// nunca tiver sido visto.

const NOW = Date.parse('2026-09-24T14:00:00Z')
const late = (min, extra = {}) => shouldProcessIncomingMessage({
  upsertType: 'notify',
  messageTimestampMs: NOW - min * 60_000,
  now: NOW,
  lateMaxAgeMs: INCOMING_LATE_MAX_AGE_MS,
  isMonitoredSource: true,
  seenBefore: false,
  ...extra,
})

test('a janela tardia é de 60 min e maior que a janela ao vivo', () => {
  assert.equal(INCOMING_LATE_MAX_AGE_MS, 60 * 60_000)
  assert.ok(INCOMING_LATE_MAX_AGE_MS > INCOMING_MAX_AGE_MS)
})

test('mensagem de origem monitorada 27–58 min atrasada, id nunca visto → passa (caso do RCA)', () => {
  for (const min of [6, 27, 45, 58]) {
    const r = late(min)
    assert.equal(r.process, true, `${min} min`)
    assert.equal(r.reason, INCOMING_ACCEPT_REASON.LATE_MONITORED_SOURCE)
    assert.equal(r.late, true)
  }
})

test('mesmo id já visto → continua descartada (reentrega não reentra)', () => {
  const r = late(30, { seenBefore: true })
  assert.equal(r.process, false)
  assert.equal(r.reason, INCOMING_DROP_REASON.STALE_REPLAY)
})

test('origem NÃO monitorada atrasada → descartada como antes', () => {
  const r = late(30, { isMonitoredSource: false })
  assert.equal(r.process, false)
  assert.equal(r.reason, INCOMING_DROP_REASON.STALE)
})

test('acima de 60 min → descartada mesmo de origem monitorada e id novo', () => {
  assert.equal(late(60).process, false)
  assert.equal(late(61).reason, INCOMING_DROP_REASON.STALE)
})

test('janela tardia desligada (0) ou menor que a ao vivo → comportamento histórico de 5 min', () => {
  for (const lateMaxAgeMs of [0, null, undefined, 60_000]) {
    assert.equal(late(30, { lateMaxAgeMs }).process, false, `lateMaxAgeMs=${lateMaxAgeMs}`)
  }
  assert.equal(late(4).process, true, 'abaixo de 5 min continua passando sem depender da janela tardia')
})

test('append sem timestamp continua descartada — a janela tardia não relaxa isso', () => {
  const r = shouldProcessIncomingMessage({ upsertType: 'append', messageTimestampMs: null, now: NOW, lateMaxAgeMs: INCOMING_LATE_MAX_AGE_MS, isMonitoredSource: true })
  assert.equal(r.process, false)
  assert.equal(r.reason, INCOMING_DROP_REASON.REPLAY_WITHOUT_TIMESTAMP)
})

test('chamada antiga (sem os parâmetros novos) se comporta exatamente como antes', () => {
  assert.equal(shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs: NOW - 30 * 60_000, now: NOW }).process, false)
  assert.equal(shouldProcessIncomingMessage({ upsertType: 'notify', messageTimestampMs: NOW - 60_000, now: NOW }).process, true)
})

// ---------- conjunto de ids vistos (em disco, no arquivo da dedup) ----------

test('id lembrado é "visto" dentro da janela e esquecido depois dela', () => {
  const store = { msgIds: [], links: {}, seenIds: {} }
  rememberSeenIncomingId(store, 'g@g.us:ABC', NOW)
  assert.equal(hasSeenIncomingId(store, 'g@g.us:ABC', NOW + 50 * 60_000, 2 * 60 * 60_000), true)
  assert.equal(hasSeenIncomingId(store, 'g@g.us:ABC', NOW + 3 * 60 * 60_000, 2 * 60 * 60_000), false)
  assert.equal(hasSeenIncomingId(store, 'g@g.us:OUTRO', NOW, 2 * 60 * 60_000), false)
  assert.equal(hasSeenIncomingId(store, null, NOW, 2 * 60 * 60_000), false)
})

test('a poda respeita a janela própria de seenIds e o teto de entradas', () => {
  const store = { msgIds: [], links: {}, seenIds: { velho: NOW - 3 * 60 * 60_000, novo: NOW - 10 * 60_000 } }
  pruneDedupStore(store, NOW, { msgIds: 300_000, links: 120 * 60_000, seenIds: 2 * 60 * 60_000 })
  assert.deepEqual(Object.keys(store.seenIds), ['novo'])

  const cheio = { msgIds: [], links: {}, seenIds: {} }
  for (let i = 0; i < MAX_SEEN_INCOMING_IDS + 10; i++) cheio.seenIds[`k${i}`] = NOW - (MAX_SEEN_INCOMING_IDS + 10 - i)
  pruneDedupStore(cheio, NOW, { msgIds: 300_000, links: 120 * 60_000, seenIds: 2 * 60 * 60_000 })
  assert.equal(Object.keys(cheio.seenIds).length, MAX_SEEN_INCOMING_IDS)
  assert.equal('k0' in cheio.seenIds, false, 'descarta as mais ANTIGAS')
  assert.equal(`k${MAX_SEEN_INCOMING_IDS + 9}` in cheio.seenIds, true)
})

test('poda com número (chamada legada) não apaga seenIds nem quebra arquivo antigo sem o campo', () => {
  const legado = { msgIds: [], links: {} }
  pruneDedupStore(legado, NOW, 300_000)
  assert.deepEqual(legado.seenIds, {})
  const store = { msgIds: [], links: {}, seenIds: { a: NOW - 60 * 60_000 } }
  pruneDedupStore(store, NOW, 300_000)
  assert.deepEqual(Object.keys(store.seenIds), ['a'])
})

// ---------- fiação no robô ----------

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('o conjunto de ids vistos fica em DISCO (arquivo da dedup), não só em memória', () => {
  assert.match(botWorkerSource, /seenIds: store\?\.seenIds && typeof store\.seenIds === 'object' \? store\.seenIds : \{\}/, 'normalizeDedup precisa carregar seenIds do arquivo')
  assert.match(botWorkerSource, /const rememberedSeen = rememberSeenIncomingId\(dedup, dedupKey, now\)/)
  assert.match(botWorkerSource, /if \(remembered \|\| rememberedSeen\) scheduleDedupSave\(dedup\)/, 'lembrar um id visto precisa persistir')
})

test('a janela dos ids vistos é sempre maior que a janela tardia', () => {
  assert.match(botWorkerSource, /const seenIncomingIdWindowMs = Math\.max\(2 \* 60 \* 60_000, 2 \* incomingLateMaxAgeMs\)/)
  assert.match(botWorkerSource, /seenIds: seenIncomingIdWindowMs/)
})

test('o portão tardio só roda para mensagem que JÁ seria descartada por idade, e exige origem monitorada + id nunca visto', () => {
  const start = botWorkerSource.indexOf("sock.ev.on('messages.upsert'")
  const body = botWorkerSource.slice(start, start + 12_000)
  assert.match(body, /freshness\.reason === INCOMING_DROP_REASON\.STALE &&\s*\n\s*incomingLateMaxAgeMs > INCOMING_MAX_AGE_MS/)
  assert.match(body, /lateCfg\?\.groups\?\.monitor\?\.some\(m => normalizeJidForMatch\(m\.waJid\) === remoteJid\)/)
  assert.match(body, /seenBefore: hasSeenIncomingId\(dedup, dedupKey, Date\.now\(\), seenIncomingIdWindowMs\)/)
  assert.match(body, /'Mensagem atrasada aceita: origem monitorada e id nunca visto/)
})

test('não regredir RCA 2026-07: a janela de msgIds continua em 5 min e a de link continua independente', () => {
  assert.match(botWorkerSource, /const dedupeWindowMs = Math\.max\(1_000, Number\(process\.env\.DEDUP_MSGID_WINDOW_MS\) \|\| 300_000\)/)
  assert.match(botWorkerSource, /const linkDedupWindowMs = Math\.max\(1_000, Number\(process\.env\.DEDUP_LINK_WINDOW_MS\) \|\| 120 \* 60_000\)/)
  assert.doesNotMatch(botWorkerSource, /const linkDedupWindowMs = Math\.max\(dedupeWindowMs,/)
})
