import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import {
  MAX_DEDUP_MSGID_ENTRIES,
  buildIncomingDedupKey,
  hasRecentDedupEntry,
  pruneDedupStore,
  rememberDedupEntry,
} from '../src/messageDedup.js'

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// RCA 2026-07: uma mensagem publicada UMA vez no grupo monitorado foi espelhada
// 5x ao longo de ~6h (14:14, 18:41, 19:42, 19:52, 20:04).
//
// A causa de PRIMEIRA ordem — a mensagem ser VISTA várias vezes — é atacada na
// origem, em src/core/incomingFreshness.js (reentrega da fila offline não
// reentra no pipeline). Ver test/incoming-freshness.test.js.
//
// Este arquivo cobre a segunda brecha, no lado do ENVIO, e guarda a decisão de
// NÃO esticar a janela de msgIds: ela vale 5min de propósito (rede contra
// re-emissão imediata), e as janelas curtas são o que a semântica de cupom
// depende.

test('janela de msgIds continua curta (5min) — não é ela a barreira contra reoferta', () => {
  const store = { msgIds: [], links: {} }
  const t0 = Date.parse('2026-07-27T17:14:00Z')
  const key = buildIncomingDedupKey({ key: { remoteJid: '123@g.us', id: 'STANZA-A' } })
  rememberDedupEntry(store, key, t0)

  const janela5min = 300_000
  assert.equal(hasRecentDedupEntry(store.msgIds, key, t0 + 60_000, janela5min), true, 're-emissão imediata continua bloqueada')

  pruneDedupStore(store, t0 + 10 * 60_000, { msgIds: janela5min, links: 120 * 60_000 })
  assert.deepEqual(store.msgIds, [], 'passados 5min a entrada sai — por isso o filtro de frescor existe')

  assert.match(
    botWorkerSource,
    /const dedupeWindowMs = Math\.max\(1_000, Number\(process\.env\.DEDUP_MSGID_WINDOW_MS\) \|\| 300_000\)/,
    'default da janela de msgIds precisa continuar 5min',
  )
})

test('pruneDedupStore aplica teto de entradas mantendo as mais novas', () => {
  const now = 1_000_000
  const store = { msgIds: [], links: {} }
  const total = MAX_DEDUP_MSGID_ENTRIES + 10
  for (let i = 0; i < total; i++) store.msgIds.push({ id: `jid:${i}`, ts: now - (total - i) })

  pruneDedupStore(store, now, { msgIds: 24 * 60 * 60_000, links: 1_000 })

  assert.equal(store.msgIds.length, MAX_DEDUP_MSGID_ENTRIES)
  assert.equal(store.msgIds.at(-1).id, `jid:${total - 1}`, 'a entrada mais nova precisa sobreviver')
  assert.equal(store.msgIds[0].id, `jid:10`, 'as mais antigas são descartadas primeiro')
})

// Guarda estrutural: as duas janelas precisam ser INDEPENDENTES. Antes,
// linkDedupWindowMs = Math.max(dedupeWindowMs, ...) — qualquer aumento em
// msgIds arrastava a janela de link junto e prenderia repost legítimo.
test('janela de link não é derivada da janela de msgIds', () => {
  assert.match(
    botWorkerSource,
    /const linkDedupWindowMs = Math\.max\(1_000, Number\(process\.env\.DEDUP_LINK_WINDOW_MS\) \|\| 120 \* 60_000\)/,
    'janela de link precisa ser independente (não Math.max com dedupeWindowMs)',
  )
})

// Brecha 2 — a dedup por DB só enxergava linhas com `sentAt` dentro da janela do
// link. `sentAt` de uma linha `queued` é o momento da criação, e um job pode
// ficar horas adiado pela preservação do destino (deferSendJob). Passados os
// 120min a linha pendente sumia da dedup e a mesma oferta era enfileirada de
// novo — quando a janela do destino abria, saíam todas em rajada.
test('dedup por DB considera envio ainda PENDENTE independente da janela do link', () => {
  assert.match(
    botWorkerSource,
    /const PENDING_DEDUP_MAX_AGE_MS = Math\.max\(60_000, Number\(process\.env\.PENDING_DEDUP_MAX_AGE_MS\) \|\| 24 \* 60 \* 60_000\)/,
    'teto de idade do pendente precisa existir com default de 24h',
  )
  assert.match(
    botWorkerSource,
    /status: \{ in: \['queued', 'sending'\] \},\s*\n\s*sentAt: \{ gte: new Date\(Date\.now\(\) - pendingDedupMaxAgeMs\) \}/,
    'o ramo de pendente precisa usar o teto de pendente, não a janela do link',
  )
  // Cupom fica de fora do teto longo: a mesma URL de campanha é reposta várias
  // vezes ao dia com códigos diferentes.
  assert.match(
    botWorkerSource,
    /const pendingDedupMaxAgeMs = isCouponLink \? effectiveDedupWindowMs : PENDING_DEDUP_MAX_AGE_MS/,
    'cupom precisa manter a janela curta também no ramo de pendente',
  )
  assert.match(
    botWorkerSource,
    /status: 'success',\s*\n\s*sentAt: \{ gte: new Date\(Date\.now\(\) - effectiveDedupWindowMs\) \}/,
    'o ramo de já-entregue precisa continuar usando effectiveDedupWindowMs',
  )
})

// Forense: sem uma linha por mensagem ACEITA (com msgId) é impossível provar,
// pelo bot.log, se a duplicata veio de reoferta do WhatsApp (mesmo key.id) ou de
// repost da fonte (key.id diferente). O log de upsert só trazia {type, count}.
test('bot-worker loga msgId de cada mensagem aceita para processamento', () => {
  assert.match(botWorkerSource, /'Mensagem aceita para processamento'/)
  assert.match(botWorkerSource, /msgId: msg\.key\.id,\s*\n\s*upsertType: type,\s*\n\s*hasValidTimestamp,/)
})
