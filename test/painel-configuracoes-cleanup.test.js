import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../dashboard/app/painel/configuracoes/page.js', import.meta.url), 'utf8')

test('/painel/configuracoes no longer exposes global cadence or global mirror template defaults', () => {
  assert.doesNotMatch(source, /Cadência entre envios/)
  assert.doesNotMatch(source, /delayMin/)
  assert.doesNotMatch(source, /delayMax/)
  assert.doesNotMatch(source, /Espelhamento com template \(padrão global\)/)
  assert.doesNotMatch(source, /mirrorTemplateKeyDefault/)
  assert.doesNotMatch(source, /primaryLinkTargetDefault/)
})
