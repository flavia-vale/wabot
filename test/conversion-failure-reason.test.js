import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONVERSION_FAILURE,
  NO_VALID_CONVERSIONS_PREFIX,
  buildNoValidConversionsErrorMsg,
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
