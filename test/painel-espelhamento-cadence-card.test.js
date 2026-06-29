import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')

test('/painel/espelhamento no longer displays global send cadence card', () => {
  assert.doesNotMatch(source, /1 envio a cada/)
  assert.doesNotMatch(source, /Evita parecer spam/)
  assert.doesNotMatch(source, /api\.getConfig\(\)/)
  assert.doesNotMatch(source, /const ritmo =/)
})
