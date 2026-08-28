// Guarda de merge: em 27-28/08 um merge duplicou o bloco de
// DESTINATION_IMAGE_MODE em src/core/imageModePolicy.js. Como `const`/`export
// const` não podem ser redeclarados, o módulo virou SyntaxError — e ele é
// importado pelo bot-worker, pelo chokepoint de entitlements e pelas rotas de
// grupo. Ou seja: NENHUM robô e NENHUMA rota de grupo subiria. Passou pelo
// gate porque os testes que falharam por causa disso não apontavam a causa.
//
// Este teste é barato e pega a classe inteira do problema: o módulo carrega?

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('o módulo de modo de imagem carrega (sem identificador duplicado)', async () => {
  const mod = await import('../src/core/imageModePolicy.js')
  assert.ok(mod.DESTINATION_IMAGE_MODE, 'módulo não exportou o enum de modo do destino')
  assert.equal(typeof mod.resolveDestinationImageMode, 'function')
  assert.equal(typeof mod.resolveGroupImageMode, 'function')
})

test('nenhum símbolo do módulo é declarado duas vezes', () => {
  const fonte = readFileSync(new URL('../src/core/imageModePolicy.js', import.meta.url), 'utf8')
  const declaracoes = [...fonte.matchAll(/^(?:export )?(?:const|function|class)\s+([A-Za-z0-9_$]+)/gm)].map(m => m[1])
  const vistos = new Set()
  const duplicados = declaracoes.filter(nome => (vistos.has(nome) ? true : (vistos.add(nome), false)))
  assert.deepEqual(duplicados, [], `declarados mais de uma vez: ${duplicados.join(', ')}`)
})

test('os módulos que dependem dele também carregam', async () => {
  // Se este arquivo quebra, o robô não sobe e as rotas de grupo somem.
  await assert.doesNotReject(import('../src/billing/groupEntitlements.js'))
})
