import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMirrorDedupKeys } from '../src/core/mirrorDedupKey.js'
import { truncateByCodePoints, sanitizeMessageForLog } from '../src/messageLogSanitizer.js'

// RCA 2026-09-11 (conta julianepumuceno16@gmail.com): o bot.log de produção
// trazia, para um destino real, `Reserva SendDedupKey falhou; seguindo com
// dedup local/global` com `unexpected end of hex escape at line 1 column 304`.
// A chave era montada com `sanitizeMessageForLog(texto).slice(0, 80)` — e
// `.slice` conta code UNITS UTF-16, então o corte caindo no meio de um emoji
// deixava metade de um par surrogate na ponta. O motor do Prisma recusa a
// gravação inteira nesse caso, e a reserva atômica cross-worker (a camada que
// fecha a corrida de milissegundos entre dois workers) deixava de existir.
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

test('truncateByCodePoints nunca deixa surrogate solto ao cortar no meio de um emoji', () => {
  // 40 emojis = 80 code units = 40 code points. Cortar em 79 code units cairia
  // exatamente no meio do 40º par.
  const texto = '😀'.repeat(40)
  for (let limite = 1; limite <= 45; limite++) {
    const out = truncateByCodePoints(texto, limite)
    assert.equal(LONE_SURROGATE_RE.test(out), false, `surrogate solto com limite=${limite}`)
  }
})

test('truncateByCodePoints corta por code point, preservando o emoji inteiro', () => {
  assert.equal(truncateByCodePoints('😀😀😀', 2), '😀😀')
  assert.equal(truncateByCodePoints('abc', 10), 'abc')
  assert.equal(truncateByCodePoints('', 10), '')
  assert.equal(truncateByCodePoints(null, 10), '')
})

test('truncateByCodePoints não acrescenta reticências (é chave técnica, não texto de tela)', () => {
  assert.equal(truncateByCodePoints('abcdef', 3).endsWith('…'), false)
})

test('reproduz o caso de produção: texto com emoji cortado em 80 não gera chave quebrada', () => {
  const texto = `${'a'.repeat(79)}😀 oferta`
  const antigo = sanitizeMessageForLog(texto).slice(0, 80) // comportamento que falhava
  assert.equal(LONE_SURROGATE_RE.test(antigo), true, 'o corte antigo precisa mesmo quebrar o par')

  const agora = truncateByCodePoints(sanitizeMessageForLog(texto), 80)
  assert.equal(LONE_SURROGATE_RE.test(agora), false)
})

test('buildMirrorDedupKeys limpa surrogate solto que chegue já quebrado de qualquer chamador', () => {
  const quebrado = `msgid:${'a'.repeat(70)}\uD83D` // surrogate alto sem par
  const { dedupKeys, dedupSubjects } = buildMirrorDedupKeys({
    destJid: '120363411423669749@g.us',
    primaryUrl: 'https://s.shopee.com.br/abc',
    fallbackSubject: quebrado,
  })
  for (const key of dedupKeys) assert.equal(LONE_SURROGATE_RE.test(key), false, key)
  for (const subject of dedupSubjects) assert.equal(LONE_SURROGATE_RE.test(subject), false)
})

test('buildMirrorDedupKeys mantém o formato destJid:assunto e não perde chave legítima', () => {
  const { dedupKeys } = buildMirrorDedupKeys({
    destJid: '120363411423669749@g.us',
    primaryUrl: 'https://s.shopee.com.br/abc',
    primaryConverted: 'https://s.shopee.com.br/xyz',
  })
  assert.deepEqual(dedupKeys, [
    '120363411423669749@g.us:https://s.shopee.com.br/abc',
    '120363411423669749@g.us:https://s.shopee.com.br/xyz',
  ])
})
