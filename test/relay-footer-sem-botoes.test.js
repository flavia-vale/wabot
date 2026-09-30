import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 2026-09-29 — a usuária pediu para tirar "Colocar link do grupo no fim" e
// "Colocar texto no fim de toda mensagem" da origem: o campo de texto adicional
// já cobre isso. Não regredir: a origem mostra só o campo de texto.
test('texto ao final da mensagem é só o campo de texto, sem as caixinhas', () => {
  const src = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')
  assert.ok(src.includes('Adicionar texto ao final da mensagem'))
  assert.ok(!src.includes('Colocar link do grupo no fim'))
  assert.ok(!src.includes('Colocar texto no fim de toda mensagem'))
})
