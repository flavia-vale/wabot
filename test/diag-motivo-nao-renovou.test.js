import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SCRIPT = readFileSync(new URL('../scripts/diag-motivo-nao-renovou.mjs', import.meta.url), 'utf8')

test('o diagnóstico é read-only', () => {
  for (const escrita of ['\\.create\\(', '\\.update\\(', '\\.delete\\(', '\\.upsert\\(', '\\.deleteMany\\(', 'executeRaw']) {
    assert.ok(!new RegExp(escrita).test(SCRIPT), `não pode escrever nada (achou "${escrita}")`)
  }
})

test('importa a classificação de churn do domínio, não reescreve a regra', () => {
  assert.match(SCRIPT, /from '\.\.\/src\/domain\/admin\/churnReason\.js'/)
  assert.match(SCRIPT, /classifyChurnReason/)
  assert.ok(
    !/hadRejectedChargeAfterFirstPayment\s*\?\s*['"]involuntario/.test(SCRIPT),
    'não pode ter cópia local da decisão involuntário/voluntário/ambíguo',
  )
})

test('reaproveita o mesmo relatório de LTV do script canônico, não recalcula renovação', () => {
  assert.match(SCRIPT, /from '\.\.\/src\/domain\/admin\/ltvRetention\.js'/)
  assert.match(SCRIPT, /buildLtvReport/)
})

test('exclui contas de teste pela mesma lista do Financeiro', () => {
  assert.match(SCRIPT, /loadTestAccountUserIds/)
})

test('avisa sobre amostra pequena em vez de afirmar causa', () => {
  assert.match(SCRIPT, /[Aa]mostra pequena/)
})
