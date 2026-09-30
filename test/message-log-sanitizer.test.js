import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeMessageForLog, MESSAGE_LOG_MAX_CHARS } from '../src/messageLogSanitizer.js'

const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

function contentWithoutEllipsis(out) {
  return out.endsWith('…') ? out.slice(0, -1) : out
}

test('trunca exatamente no meio de um par surrogate de emoji sem deixar surrogate solto', () => {
  const emoji = '😀' // U+1F600, par surrogate
  const input = emoji.repeat(MESSAGE_LOG_MAX_CHARS + 50)
  const out = sanitizeMessageForLog(input)

  assert.equal(LONE_SURROGATE_RE.test(out), false, 'não deve conter surrogate solto')
  assert.ok(out.endsWith('…'), 'deve indicar truncagem')
})

test('trunca por code point (não por code unit) para texto majoritariamente multi-byte', () => {
  const emoji = '🎉'
  const input = emoji.repeat(MESSAGE_LOG_MAX_CHARS + 100)
  const out = sanitizeMessageForLog(input)
  const contentCodePoints = Array.from(contentWithoutEllipsis(out)).length

  assert.ok(contentCodePoints <= MESSAGE_LOG_MAX_CHARS, 'contagem por code point deve respeitar o limite')
  assert.equal(LONE_SURROGATE_RE.test(out), false)
})

test('remove NUL e caracteres de controle do resultado', () => {
  const input = 'ola\x00mundo\x01com\x1Fcontrole\x7F'
  const out = sanitizeMessageForLog(input)

  assert.equal(out.includes('\x00'), false)
  assert.equal(out.includes('\x01'), false)
  assert.equal(out.includes('\x1F'), false)
  assert.equal(out.includes('\x7F'), false)
  assert.equal(out, 'olamundocomcontrole')
})

test('entradas null/vazia/não-string retornam string vazia sem lançar', () => {
  assert.equal(sanitizeMessageForLog(null), '')
  assert.equal(sanitizeMessageForLog(undefined), '')
  assert.equal(sanitizeMessageForLog(''), '')
  assert.doesNotThrow(() => sanitizeMessageForLog(123))
  assert.equal(sanitizeMessageForLog(123), '123')
  assert.doesNotThrow(() => sanitizeMessageForLog({ toString: () => 'obj' }))
})

test('texto sanitizado nunca excede MESSAGE_LOG_MAX_CHARS code points de conteúdo', () => {
  const input = 'a'.repeat(MESSAGE_LOG_MAX_CHARS * 3)
  const out = sanitizeMessageForLog(input)
  const contentCodePoints = Array.from(contentWithoutEllipsis(out)).length

  assert.ok(contentCodePoints <= MESSAGE_LOG_MAX_CHARS)
})

test('texto dentro do limite não é truncado (sem reticências)', () => {
  const input = 'mensagem curta com emoji 😀'
  const out = sanitizeMessageForLog(input)

  assert.equal(out, input)
  assert.equal(out.endsWith('…'), false)
})

test('normaliza whitespace e faz trim antes de truncar', () => {
  const input = '  ola   mundo  \n\t com   espacos  '
  const out = sanitizeMessageForLog(input)

  assert.equal(out, 'ola mundo com espacos')
})

test('lone surrogate já presente na entrada (input malformado) é removido', () => {
  const input = 'a' + '\uD83D' + 'b' // high surrogate solto, sem low pair
  const out = sanitizeMessageForLog(input)

  assert.equal(LONE_SURROGATE_RE.test(out), false)
  assert.equal(out, 'ab')
})

// RCA 2026-09-30: o reenvio pós-restart mandava `messageText` (240 chars, sem
// quebras de linha). resendText guarda a oferta inteira, como saiu.
test('sanitizeResendText preserva quebras de linha e texto longo', async () => {
  const { sanitizeResendText } = await import('../src/messageLogSanitizer.js')
  const oferta = `💥 CHOCADO COM ESSE VALOR!\n\n🏷️ *Gabinete Gamer*\n${'detalhe '.repeat(60)}\n👉 https://s.shopee.com.br/abc`
  assert.equal(sanitizeResendText(oferta), oferta)
  assert.ok(sanitizeResendText(oferta).length > MESSAGE_LOG_MAX_CHARS)
})

test('sanitizeResendText tira NUL e surrogate solto, sem mexer no resto', async () => {
  const { sanitizeResendText } = await import('../src/messageLogSanitizer.js')
  assert.equal(sanitizeResendText('a\u0000b\nc\uD83D'), 'ab\nc')
})

test('sanitizeResendText devolve null para vazio e acima do teto (não reenvia cortado)', async () => {
  const { sanitizeResendText, RESEND_TEXT_MAX_CHARS } = await import('../src/messageLogSanitizer.js')
  assert.equal(sanitizeResendText(''), null)
  assert.equal(sanitizeResendText('   \n '), null)
  assert.equal(sanitizeResendText(null), null)
  assert.equal(sanitizeResendText('x'.repeat(RESEND_TEXT_MAX_CHARS + 1)), null)
  assert.equal(sanitizeResendText('x'.repeat(RESEND_TEXT_MAX_CHARS)).length, RESEND_TEXT_MAX_CHARS)
})
