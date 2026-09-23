import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONVERSION_FAILURE,
  NO_VALID_CONVERSIONS_PREFIX,
  buildNoValidConversionsErrorMsg,
  hasPublishableConversion,
  isMissingCredentialFailure,
  isNoValidConversionsErrorMsg,
  parseConversionFailureReason,
  pickConversionFailureReason,
} from '../src/core/conversionFailureReason.js'

test('sem motivo conhecido grava o formato histórico, sem inventar causa', () => {
  assert.equal(buildNoValidConversionsErrorMsg([]), NO_VALID_CONVERSIONS_PREFIX)
  assert.equal(buildNoValidConversionsErrorMsg([null, 'coisa_qualquer']), NO_VALID_CONVERSIONS_PREFIX)
  assert.equal(pickConversionFailureReason(['inexistente']), null)
})

test('mensagem com vários links reporta o motivo mais acionável', () => {
  const todos = [CONVERSION_FAILURE.CONVERSION_FAILED, CONVERSION_FAILURE.STORE_DISABLED, CONVERSION_FAILURE.MISSING_CREDENTIAL]
  assert.equal(pickConversionFailureReason(todos), CONVERSION_FAILURE.MISSING_CREDENTIAL)
  assert.equal(
    pickConversionFailureReason([CONVERSION_FAILURE.CONVERSION_FAILED, CONVERSION_FAILURE.STORE_DISABLED]),
    CONVERSION_FAILURE.STORE_DISABLED,
  )
})

test('o motivo sobrevive à ida e volta pelo errorMsg', () => {
  for (const motivo of Object.values(CONVERSION_FAILURE)) {
    const msg = buildNoValidConversionsErrorMsg([motivo])
    assert.equal(msg, `${NO_VALID_CONVERSIONS_PREFIX}:${motivo}`)
    assert.equal(parseConversionFailureReason(msg), motivo)
    assert.ok(isNoValidConversionsErrorMsg(msg))
  }
})

test('só o motivo de falta de cadastro AFIRMA que faltou cadastrar a loja', () => {
  assert.ok(isMissingCredentialFailure(`${NO_VALID_CONVERSIONS_PREFIX}:${CONVERSION_FAILURE.MISSING_CREDENTIAL}`))
  // Este é o caso da RCA 2026-09-09: chave da Shopee viva, 248 envios com
  // sucesso na mesma janela, e a tela dizia que faltava cadastrar a loja.
  assert.equal(isMissingCredentialFailure(`${NO_VALID_CONVERSIONS_PREFIX}:${CONVERSION_FAILURE.CONVERSION_FAILED}`), false)
  assert.equal(isMissingCredentialFailure(`${NO_VALID_CONVERSIONS_PREFIX}:${CONVERSION_FAILURE.STORE_DISABLED}`), false)
})

test('linha antiga (sem motivo) não afirma falta de cadastro — não sabemos a causa', () => {
  assert.equal(isMissingCredentialFailure(NO_VALID_CONVERSIONS_PREFIX), false)
  assert.ok(isNoValidConversionsErrorMsg(NO_VALID_CONVERSIONS_PREFIX))
  assert.equal(parseConversionFailureReason(NO_VALID_CONVERSIONS_PREFIX), null)
})

test('outros errorMsg não são confundidos', () => {
  for (const outro of ['skip:dedup_recent_link', 'error:worker_restart', '', null, undefined]) {
    assert.equal(isNoValidConversionsErrorMsg(outro), false)
    assert.equal(isMissingCredentialFailure(outro), false)
  }
})

// RCA 2026-09-23: com a chave da Shopee recusada, a mensagem saía com o link
// original do grupo de origem (comissão do concorrente) e era gravada como
// sucesso. Link só "passthrough" não é oferta publicável.
test('mensagem só com link não convertido (passthrough) NÃO é publicável', () => {
  const original = 'https://s.shopee.com.br/concorrente'
  assert.equal(hasPublishableConversion([{ platform: 'shopee', url: original, converted: original, passthrough: true }]), false)
  assert.equal(hasPublishableConversion([]), false)
  assert.equal(hasPublishableConversion(null), false)
})

test('link convertido de verdade torna a mensagem publicável, mesmo com passthrough junto', () => {
  assert.equal(hasPublishableConversion([
    { platform: 'shopee', url: 'https://s.shopee.com.br/cupom', converted: 'https://s.shopee.com.br/cupom', passthrough: true },
    { platform: 'amazon', url: 'https://amzn.to/x', converted: 'https://amzn.to/nosso' },
  ]), true)
})

test('o worker decide o descarte com hasPublishableConversion, e o passthrough carrega motivo', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /if \(!hasPublishableConversion\(conversions\)\) \{/)
  assert.doesNotMatch(src, /if \(!conversions\.length\) \{\n\s+await db\.messageLog\.create/)
  assert.match(src, /passthrough: true, linkKind: 'coupon', failureReason: CONVERSION_FAILURE\.CONVERSION_FAILED/)
})
