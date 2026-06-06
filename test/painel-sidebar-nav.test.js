import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const navSource = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')

function operationBlock() {
  const start = navSource.indexOf("title: 'Operação'")
  const end = navSource.indexOf("title: 'Configuração'", start)
  assert.notEqual(start, -1, 'grupo Operação deve existir')
  assert.notEqual(end, -1, 'grupo Configuração deve vir após Operação')
  return navSource.slice(start, end)
}

test('sidebar keeps Criar oferta inside Operação after Painel and before Espelhamento', () => {
  const block = operationBlock()
  const painel = block.indexOf("label: 'Painel'")
  const criarOferta = block.indexOf("label: 'Criar oferta'")
  const espelhamento = block.indexOf("label: 'Espelhamento'")

  assert.notEqual(criarOferta, -1, 'Criar oferta deve ser um item do grupo Operação')
  assert.ok(painel < criarOferta, 'Criar oferta deve vir depois de Painel')
  assert.ok(criarOferta < espelhamento, 'Criar oferta deve vir antes de Espelhamento')
})

test('sidebar marks Criar oferta with a GRÁTIS badge instead of top CTA highlight', () => {
  const block = operationBlock()
  const criarOfertaItem = block.slice(block.indexOf("label: 'Criar oferta'"), block.indexOf("label: 'Espelhamento'"))

  assert.match(criarOfertaItem, /href:\s*'\/painel\/criar-oferta'/, 'Criar oferta deve apontar para a rota atual')
  assert.match(criarOfertaItem, /free:\s*true/, 'Criar oferta deve declarar badge grátis')
  assert.doesNotMatch(shellSource, /<Link href=\{TOP_CTA\.href\}/, 'Criar oferta não deve aparecer como CTA destacado no topo')
  assert.match(shellSource, /item\.free\s*&&\s*<span className="pnl-free">GRÁTIS<\/span>/, 'shell deve renderizar badge GRÁTIS para item grátis')
})
