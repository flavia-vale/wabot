import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')

test('campo "Enviar para qual grupo?" leva ao Espelhamento para cadastrar destino', () => {
  const i = src.indexOf('Enviar para qual grupo?')
  assert.ok(i > 0)
  const trecho = src.slice(i, i + 300)
  assert.match(trecho, /href="\/painel\/espelhamento"/)
  assert.match(trecho, /Cadastre um grupo de destino aqui\./)
})
