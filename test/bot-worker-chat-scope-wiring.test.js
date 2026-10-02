// Guarda ESTRUTURAL da Fase 2 (escopo de conversas). As propriedades de
// segurança abaixo não aparecem em teste de unidade da política pura — elas
// vivem na FIAÇÃO dentro do bot-worker, e é ali que somem num refactor
// distraído. Mesma filosofia de test/bot-worker-retry-cache-wiring.test.js.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('a regra nova é consultada no gancho do socket', () => {
  assert.match(source, /shouldIgnoreJid: \(jid\) => \{/)
  assert.match(source, /shouldIgnoreByChatScope\(jid, \{/)
})

test('o default é `dm` (conversa individual fora da lista não é aberta)', () => {
  // Env ausente → 'dm'; valor desconhecido → 'off' (normalizeChatScopeMode).
  assert.match(source, /const CHAT_SCOPE_MODE = normalizeChatScopeMode\(process\.env\.WA_CHAT_SCOPE_MODE \?\? DEFAULT_WORKER_CHAT_SCOPE_MODE\)/)
  // Default `dm` (RCA 2026-10-02): conversa individual fora da lista nunca é aberta.
  // Nunca `dm+group`/`strict` por default — grupo/canal ficam com as regras próprias.
  assert.match(source, /const DEFAULT_WORKER_CHAT_SCOPE_MODE = 'dm'/)
})

test('a regra antiga continua valendo quando o modo novo está desligado', () => {
  // Ligar a Fase 2 não pode desligar em silêncio quem já usa a flag antiga.
  assert.match(source, /return shouldIgnoreChatJid\(jid, \{/)
})

test('a identidade da própria conta entra na lista no open', () => {
  assert.match(source, /selfChatJids = buildAllowedJidSet\(\[sock\.user\?\.id, sock\.user\?\.lid/)
  assert.match(source, /selfJids: selfChatJids/)
})

test('o freio de emergência roda periodicamente, não só sob demanda', () => {
  assert.match(source, /try \{ reviewChatScope\(\) \} catch \{\}/)
  assert.match(source, /shouldAutoDisableChatScope\(\{/)
})

test('mensagem aceita zera o contador do freio', () => {
  assert.match(source, /function markMessageAccepted\(\) \{[\s\S]*chatScopeIgnoredSinceLastAccepted = 0/)
})

test('o que foi ignorado é contado e amostrado, não invisível', () => {
  assert.match(source, /function recordChatScopeIgnored\(type, jid\)/)
  assert.match(source, /WA_CHAT_SCOPE_LOG_SAMPLE/)
  assert.match(source, /ops? ?_?wa_chat_scope_filtered|wa_chat_scope_filtered/)
})

test('o sinal durável é agregado por janela, nunca por mensagem', () => {
  // Só o corpo da função que roda POR MENSAGEM.
  const trecho = source.slice(source.indexOf('function recordChatScopeIgnored'), source.indexOf('function getChatScopeSnapshot'))
  assert.doesNotMatch(trecho, /recordOperationalSignal\('wa_chat_scope_filtered'/, 'sinal por mensagem inundaria o banco')
  assert.match(source, /CHAT_SCOPE_SIGNAL_INTERVAL_MS/)
})

test('o estado do escopo é exposto nas métricas para a visão admin', () => {
  assert.match(source, /chatScope: getChatScopeSnapshot\(\)/)
})

test('freio de emergência conta só grupo/canal descartado (RCA 2026-10-02)', () => {
  assert.match(source, /if \(countsTowardChatScopePanic\(type\)\) chatScopeIgnoredSinceLastAccepted \+= 1/)
  assert.doesNotMatch(source, /\n  chatScopeIgnoredSinceLastAccepted \+= 1\n/)
})
