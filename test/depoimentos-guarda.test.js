import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DEPOIMENTOS, depoimentoValido, depoimentosPublicaveis } from '../dashboard/lib/depoimentos.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const bom = {
  nome: 'Ana S.',
  papel: 'Afiliada Shopee',
  texto: 'Conectei o WhatsApp lendo o QR code e funcionou.',
  autorizadoEm: '2026-09-30',
  origem: 'conversa de WhatsApp guardada em 30/09/2026',
}

test('depoimento sem autorização, origem, nome ou papel não é publicável', () => {
  assert.equal(depoimentoValido(bom), true)
  for (const campo of ['autorizadoEm', 'origem', 'nome', 'papel', 'texto']) {
    assert.equal(depoimentoValido({ ...bom, [campo]: '' }), false, campo)
  }
  assert.equal(depoimentoValido({ ...bom, autorizadoEm: '30/09/2026' }), false)
  assert.equal(depoimentoValido({ ...bom, nota: 6 }), false)
  assert.equal(depoimentoValido({ ...bom, nota: 5 }), true)
})

test('depoimento com promessa de ganho ou anti-ban não é publicável', () => {
  for (const frase of ['Dobrei minhas comissões', 'nunca fui banida', 'é anti-ban de verdade', 'comissão garantida']) {
    assert.equal(depoimentoValido({ ...bom, texto: frase }), false, frase)
  }
})

test('todo item em lib/depoimentos.js já passa na regra (nada de rascunho publicado)', () => {
  assert.equal(depoimentosPublicaveis().length, DEPOIMENTOS.length)
})

test('o bloco não renderiza cartão de exemplo: sem item válido devolve null', () => {
  const src = readFileSync(join(repoRoot, 'dashboard/components/landing/Depoimentos.jsx'), 'utf8')
  assert.match(src, /itens\.length === 0\) return null/)
  for (const exemplo of ['Sol Almeida', 'Renata M.', 'Carla F.', 'Juliana P.']) {
    assert.ok(!src.includes(exemplo))
    assert.ok(!JSON.stringify(DEPOIMENTOS).includes(exemplo))
  }
})
