import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const navSource = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')

function journeyBlock() {
  const start = navSource.indexOf("title: 'Início'")
  const end = navSource.indexOf("title: 'Configuração'", start)
  assert.notEqual(start, -1, 'grupo Início deve existir')
  assert.notEqual(end, -1, 'grupo Configuração deve vir após Acompanhar')
  return navSource.slice(start, end)
}

function acompanharBlock() {
  const start = navSource.indexOf("title: 'Acompanhar'")
  const end = navSource.indexOf("title: 'Configuração'", start)
  assert.notEqual(start, -1, 'grupo Acompanhar deve existir')
  assert.notEqual(end, -1, 'grupo Configuração deve vir após Acompanhar')
  return navSource.slice(start, end)
}

test('sidebar keeps Criar oferta after Painel and before Espelhar grupos', () => {
  const block = journeyBlock()
  const painel = block.indexOf("label: 'Painel'")
  const criarOferta = block.indexOf("label: 'Criar oferta'")
  const espelhamento = block.indexOf("label: 'Espelhar grupos'")

  assert.notEqual(criarOferta, -1, 'Criar oferta deve permanecer na jornada principal')
  assert.ok(painel < criarOferta, 'Criar oferta deve vir depois de Painel')
  assert.ok(criarOferta < espelhamento, 'Criar oferta deve vir antes de Espelhar grupos')
})

test('sidebar keeps Criar oferta on its current route instead of a top CTA', () => {
  const block = journeyBlock()
  const criarOfertaItem = block.slice(block.indexOf("label: 'Criar oferta'"), block.indexOf("label: 'Espelhar grupos'"))

  assert.match(criarOfertaItem, /href:\s*'\/painel\/criar-oferta'/, 'Criar oferta deve apontar para a rota atual')
  assert.doesNotMatch(shellSource, /<Link href=\{TOP_CTA\.href\}/, 'Criar oferta não deve aparecer como CTA destacado no topo')
  assert.match(shellSource, /item\.free\s*&&\s*<span className="pnl-free">GRÁTIS<\/span>/, 'shell deve preservar suporte ao badge GRÁTIS')
})

test('sidebar consolida acompanhamento em um único item Envios', () => {
  const block = acompanharBlock()
  assert.equal((block.match(/label:\s*'Envios'/g) || []).length, 1)
  assert.match(block, /label:\s*'Envios'[\s\S]*?href:\s*'\/painel\/envios'/)
  assert.doesNotMatch(block, /label:\s*'Agendados'/)
  assert.doesNotMatch(block, /label:\s*'Histórico de envios'/)
  assert.doesNotMatch(block, /href:\s*'\/painel\/agendados'/)
})
