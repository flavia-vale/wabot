// specs/017-client-coupon-catalog (T008, FR-026): trava a REDAÇÃO da tela de
// cupons em linguagem de gente. Mesmo padrão de test/painel-linguagem-leiga.test.js
// — varredura de readFileSync sobre o código-fonte da tela.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../dashboard/app/painel/cupons/page.js', import.meta.url), 'utf8')

// Extrai só o que a usuária efetivamente LÊ: strings literais dentro de JSX/
// atributos comuns (placeholder, texto entre tags) — não o código-fonte
// inteiro (que legitimamente usa `platform`/`discountType`/`enabled` como
// nomes de campo do payload da API).
const VISIBLE_STRING_RE = /(?:placeholder|title|message)=["']([^"']+)["']|>([^<>{}\n][^<>{}]*)</g

function textosVisiveis() {
  const textos = []
  let match
  while ((match = VISIBLE_STRING_RE.exec(pageSource))) {
    const text = (match[1] ?? match[2] ?? '').trim()
    if (text) textos.push(text)
  }
  return textos
}

const JARGAO_PROIBIDO = [
  /\bplatform\b/,
  /\bdiscountType\b/,
  /\benabled\b/,
  /\bvalidUntil\b/,
  /\bid do cupom\b/i,
  /\btoken\b/i,
  /\bpayload\b/i,
  /\bendpoint\b/i,
  /\bpercent\b/,
  /\bamount\b/,
]

test('nenhum jargão técnico no texto visível da tela de cupons', () => {
  const textos = textosVisiveis()
  assert.ok(textos.length > 0, 'a varredura não encontrou nenhum texto visível — confira o regex')
  for (const texto of textos) {
    for (const proibido of JARGAO_PROIBIDO) {
      assert.doesNotMatch(texto, proibido, `jargão em: "${texto}"`)
    }
  }
})

test('rótulos de campo (pnl-label) usam linguagem de gente, não nome de campo técnico', () => {
  const labelSpans = [...pageSource.matchAll(/className="pnl-label">([^<]+)</g)].map((m) => m[1])
  assert.ok(labelSpans.length > 0)
  // Um rótulo pode ser uma expressão condicional JS (ex.: escolhe o texto
  // conforme o tipo de desconto) — extrai as strings literais de dentro dele
  // em vez de checar a expressão inteira (que legitimamente referencia o
  // nome do campo do estado do formulário, nunca visto pela usuária).
  const literalRe = /'([^']*)'|"([^"]*)"/g
  const labels = []
  for (const span of labelSpans) {
    const trimmed = span.trim()
    if (/^['"]/.test(trimmed)) {
      labels.push(trimmed.replace(/^['"]|['"]$/g, ''))
      continue
    }
    // Ternário `cond ? 'A' : 'B'`: só 'A' e 'B' chegam à tela — a condição
    // (ex.: `form.discountType === 'percent'`) é comparação interna, nunca
    // vista pela usuária. Isola o que vem depois do primeiro `?`.
    const ternaryBody = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?') + 1) : trimmed
    let m
    while ((m = literalRe.exec(ternaryBody))) labels.push(m[1] ?? m[2])
  }
  assert.ok(labels.length > 0)
  for (const label of labels) {
    for (const proibido of JARGAO_PROIBIDO) {
      assert.doesNotMatch(label, proibido, `jargão em rótulo: "${label}"`)
    }
  }
})
