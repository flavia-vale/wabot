// RCA 2026-09-24: conta com só Shopee e Mercado Livre cadastrados, grupos
// ligados só nessas duas lojas, viu 112 ofertas de Amazon em VERMELHO com
// "seu cadastro está certo, ligue a loja" (não havia cadastro) e 78 ofertas
// reenviadas depois de um reinício marcadas como "falhou". Concluiu que o
// espelhamento tinha parado — com 169 envios entregues na mesma janela.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  CONVERSION_FAILURE,
  buildNoValidConversionsErrorMsg,
  isMissingCredentialFailure,
  pickConversionFailureReason,
} from '../src/core/conversionFailureReason.js'
import { describeConversionFailure } from '../src/credentialBlockAlert/message.js'
import { explainErrorMsg, statusTagForLog } from '../dashboard/lib/painel/logsCopy.js'

test('loja sem cadastro e desligada no grupo não é falha nem "cadastro certo"', () => {
  const msg = buildNoValidConversionsErrorMsg([CONVERSION_FAILURE.STORE_NOT_USED])
  const d = describeConversionFailure(msg, 'amazon')
  assert.equal(d.motivo, CONVERSION_FAILURE.STORE_NOT_USED)
  assert.equal(d.tag.cls, 'is-skip')
  assert.notEqual(d.tag.cls, 'is-error')
  assert.ok(!/cadastro está certo/i.test(d.texto), d.texto)
  assert.ok(d.texto.includes('Amazon'))
  assert.equal(isMissingCredentialFailure(msg), false)
  assert.equal(statusTagForLog({ status: 'skipped', errorMsg: msg, platform: 'amazon' }).cls, 'is-skip')
})

test('loja cadastrada e desligada no grupo continua com o texto de loja desligada', () => {
  const d = describeConversionFailure('skip:no_valid_conversions:store_disabled', 'amazon')
  assert.equal(d.motivo, CONVERSION_FAILURE.STORE_DISABLED)
})

test('loja não usada é o motivo MENOS acionável numa mensagem com vários links', () => {
  for (const outro of [CONVERSION_FAILURE.MISSING_CREDENTIAL, CONVERSION_FAILURE.STORE_DISABLED, CONVERSION_FAILURE.CONVERSION_FAILED]) {
    assert.equal(pickConversionFailureReason([CONVERSION_FAILURE.STORE_NOT_USED, outro]), outro)
  }
})

test('o robô separa loja desligada COM cadastro de loja desligada SEM cadastro', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  const i = src.indexOf("logger.info({ platform }, 'Plataforma desabilitada — pulando')")
  assert.ok(i > 0)
  const trecho = src.slice(i, i + 900)
  assert.match(trecho, /validateCredentialData\(platform, cfg\.credentials\[platform\]\)\.configured/)
  assert.match(trecho, /CONVERSION_FAILURE\.STORE_NOT_USED/)
})

test('oferta reenviada após reinício não aparece como "falhou"', () => {
  const log = { status: 'error', errorMsg: 'error:worker_restart:requeued', platform: 'shopee' }
  const tag = statusTagForLog(log)
  assert.equal(tag.cls, 'is-info')
  assert.equal(tag.label, 'reenviada')
  assert.match(explainErrorMsg(log.errorMsg, log.platform), /de novo na fila/)
  // o reinício SEM reenvio continua sendo falha de verdade
  assert.equal(statusTagForLog({ status: 'error', errorMsg: 'error:worker_restart' }).cls, 'is-error')
})
