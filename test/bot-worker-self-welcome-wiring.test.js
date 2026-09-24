import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// Piloto de reforço de ativação (2026-09-23): mensagem de boas-vindas pelo
// próprio WhatsApp na 1ª conexão de conta do piloto. Testes estruturais
// (grep de source) porque bot-worker.js roda como processo próprio — mesmo
// padrão de bot-worker-retry-cache-wiring.test.js.

test('a decisão de enviar é IMPORTADA de src/core/selfWelcomeMessage.js, nunca reescrita aqui', () => {
  assert.match(src, /from '\.\/core\/selfWelcomeMessage\.js'/)
  assert.match(src, /shouldSendSelfWelcomeMessage/)
  assert.match(src, /resolveSelfWelcomePilotEmails/)
})

test('hadPhoneBefore é lido ANTES do persistSessionPatch sobrescrever o telefone', () => {
  const readIndex = src.indexOf('hadPhoneBeforeThisOpen = Boolean(')
  const persistIndex = src.indexOf("await persistSessionPatch({ status: 'connected', phone,")
  assert.notEqual(readIndex, -1, 'leitura de hadPhoneBeforeThisOpen não encontrada')
  assert.notEqual(persistIndex, -1, 'persistSessionPatch da conexão não encontrado')
  assert.ok(
    readIndex < persistIndex,
    'ler o telefone anterior DEPOIS de persistSessionPatch sempre vê o valor já sobrescrito — reenviaria a cada reconexão',
  )
})

test('o destino é sempre o PRÓPRIO número (phone@s.whatsapp.net), nunca grupo/contato', () => {
  const fnStart = src.indexOf('async function maybeSendSelfWelcomeMessage(')
  assert.notEqual(fnStart, -1, 'maybeSendSelfWelcomeMessage não encontrada')
  const fnBody = src.slice(fnStart, fnStart + 1200)
  assert.match(fnBody, /`\$\{phone\}@s\.whatsapp\.net`/)
  assert.doesNotMatch(fnBody, /@g\.us|@newsletter/)
})

test('best-effort: falha no envio não pode lançar pro handler de conexão', () => {
  const fnStart = src.indexOf('async function maybeSendSelfWelcomeMessage(')
  const fnBody = src.slice(fnStart, fnStart + 1200)
  assert.match(fnBody, /catch \(err\)/)
  assert.match(src, /maybeSendSelfWelcomeMessage\(\{ phone, sock, hadPhoneBefore: hadPhoneBeforeThisOpen \}\)\.catch\(/)
})

test('emite o sinal ops_self_welcome_message_sent, na allowlist do analytics', () => {
  assert.match(src, /ops_self_welcome_message_sent/)
  const analytics = readFileSync(join(__dirname, '../src/analytics.js'), 'utf8')
  assert.match(analytics, /'ops_self_welcome_message_sent'/)
})
