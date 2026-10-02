import test from 'node:test'
import assert from 'node:assert/strict'
import { ERROR_CATEGORIES, categorizeErrorMsg } from '../src/errorTaxonomy.js'
import {
  DELIVERY_FAILURE_REASONS,
  buildDeliveryFailureCode,
  categorizeDeliveryFailure,
  describeDeliveryFailure,
} from '../src/core/delivery/deliveryFailure.js'
import { explainErrorMsg } from '../dashboard/lib/painel/logsCopy.js'

// Feature 017, T031 (FR-028/SC-007): todo motivo de falha de um aplicativo
// cai dentro da taxonomia que já existe e tem explicação leiga PRÓPRIA —
// nenhum vira o "erro genérico" que a cliente não entende.

const allReasons = Object.entries(DELIVERY_FAILURE_REASONS)
  .flatMap(([rede, motivos]) => Object.keys(motivos).map((motivo) => ({ rede, motivo })))

test('há motivos declarados para o Telegram', () => {
  assert.ok(allReasons.some((r) => r.rede === 'telegram'))
})

test('cada motivo cai numa categoria que já existe, nunca em "desconhecido"', () => {
  const known = new Set(Object.values(ERROR_CATEGORIES))
  for (const { rede, motivo } of allReasons) {
    const code = buildDeliveryFailureCode(rede, motivo)
    const categoria = categorizeDeliveryFailure(code)
    assert.ok(known.has(categoria), `${code} → ${categoria}`)
    assert.notEqual(categoria, ERROR_CATEGORIES.UNKNOWN, code)
    // O agregador genérico também entende o prefixo (não quebra o resumo).
    assert.notEqual(categorizeErrorMsg(code), ERROR_CATEGORIES.UNKNOWN, code)
  }
})

test('cada motivo tem texto próprio, sem jargão, e o histórico mostra esse texto', () => {
  const textos = new Set()
  for (const { rede, motivo } of allReasons) {
    const code = buildDeliveryFailureCode(rede, motivo)
    const texto = describeDeliveryFailure(code)
    assert.ok(texto && texto.length > 30, code)
    assert.doesNotMatch(texto, /\b(token|chat_id|webhook|Bot API|adaptador|plataforma|canal)\b/i, code)
    assert.equal(explainErrorMsg(code, null), texto, `${code} precisa chegar ao histórico`)
    textos.add(texto)
  }
  assert.equal(textos.size, allReasons.length, 'dois motivos com o mesmo texto não explicam nada')
})

test('motivo ainda sem catálogo diz qual aplicativo falhou, sem cair no genérico', () => {
  const texto = describeDeliveryFailure('error:delivery:telegram:motivo_novo')
  assert.ok(texto)
  assert.match(texto, /aplicativo/)
  assert.equal(describeDeliveryFailure('error:other:x'), null)
})
