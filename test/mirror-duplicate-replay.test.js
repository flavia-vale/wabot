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
// 5x ao longo de ~6h (14:14, 18:41, 19:42, 19:52, 20:04). As duas brechas que
// permitiam isso estão cobertas aqui.

// Brecha 1 — a janela de msgIds era 5min. `remoteJid:key.id` é único por
// mensagem no WhatsApp: lembrar dele só 5min deixava qualquer reoferta posterior
// (reconexão/offline sync/retry-receipt travado) reentrar no pipeline, com a
// janela de LINK (120min) como única barreira — e ela já tinha expirado.
test('mesma mensagem reofertada horas depois continua deduplicada (janela msgIds de 24h)', () => {
  const store = { msgIds: [], links: {} }
  const t0 = Date.parse('2026-07-27T17:14:00Z')
  const key = buildIncomingDedupKey({ key: { remoteJid: '123@g.us', id: 'STANZA-A' } })

  rememberDedupEntry(store, key, t0)

  const janela24h = 24 * 60 * 60_000
  for (const horas of [4.5, 5.5, 5.8, 6]) {
    const agora = t0 + horas * 60 * 60_000
    pruneDedupStore(store, agora, { msgIds: janela24h, links: 120 * 60_000 })
    assert.equal(
      hasRecentDedupEntry(store.msgIds, key, agora, janela24h),
      true,
      `reoferta ${horas}h depois precisa continuar bloqueada`,
    )
  }

  // Passadas 24h a entrada sai (teto de memória), mas aí não é mais o mesmo dia.
  const depois = t0 + 25 * 60 * 60_000
  pruneDedupStore(store, depois, { msgIds: janela24h, links: 120 * 60_000 })
  assert.deepEqual(store.msgIds, [])
})

test('janela longa de msgIds não bloqueia mensagem diferente do mesmo grupo', () => {
  const store = { msgIds: [], links: {} }
  const t0 = Date.now()
  const janela = 24 * 60 * 60_000
  rememberDedupEntry(store, buildIncomingDedupKey({ key: { remoteJid: '123@g.us', id: 'A' } }), t0)
  const outra = buildIncomingDedupKey({ key: { remoteJid: '123@g.us', id: 'B' } })
  assert.equal(hasRecentDedupEntry(store.msgIds, outra, t0 + 60_000, janela), false)
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
// linkDedupWindowMs = Math.max(dedupeWindowMs, ...) — com msgIds em 24h isso
// arrastaria a janela de link pra 24h e prenderia repost legítimo de oferta.
test('janela de link não é derivada da janela de msgIds', () => {
  assert.match(
    botWorkerSource,
    /const dedupeWindowMs = Math\.max\(1_000, Number\(process\.env\.DEDUP_MSGID_WINDOW_MS\) \|\| 24 \* 60 \* 60_000\)/,
    'janela de msgIds precisa ter default de 24h',
  )
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
    /status: \{ in: \['queued', 'sending'\] \},\s*\n\s*sentAt: \{ gte: new Date\(Date\.now\(\) - PENDING_DEDUP_MAX_AGE_MS\) \}/,
    'o ramo de pendente precisa usar PENDING_DEDUP_MAX_AGE_MS, não a janela do link',
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
