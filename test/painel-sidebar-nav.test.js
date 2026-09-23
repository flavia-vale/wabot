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

test('sidebar keeps Criar oferta after Painel and before Espelhamento', () => {
  const block = journeyBlock()
  const painel = block.indexOf("label: 'Painel'")
  const criarOferta = block.indexOf("label: 'Criar oferta'")
  const espelhamento = block.indexOf("label: 'Espelhamento'")

  assert.notEqual(criarOferta, -1, 'Criar oferta deve permanecer na jornada principal')
  assert.ok(painel < criarOferta, 'Criar oferta deve vir depois de Painel')
  assert.ok(criarOferta < espelhamento, 'Criar oferta deve vir antes de Espelhamento')
})

test('sidebar keeps Criar oferta on its current route instead of a top CTA', () => {
  const block = journeyBlock()
  const criarOfertaItem = block.slice(block.indexOf("label: 'Criar oferta'"), block.indexOf("label: 'Espelhamento'"))

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

test('sidebar mantém Filas dentro de Criar & enviar', () => {
  const block = journeyBlock()
  const enviarAgora = block.indexOf("label: 'Enviar agora'")
  const filas = block.indexOf("label: 'Filas'")
  const configuracaoStart = navSource.indexOf("title: 'Configuração'")
  const configBlock = navSource.slice(configuracaoStart)

  assert.notEqual(filas, -1, 'Filas deve ficar no grupo Criar & enviar')
  assert.ok(enviarAgora < filas, 'Filas deve aparecer depois de Enviar agora')
  assert.doesNotMatch(configBlock, /label:\s*'Filas'/, 'Filas não deve permanecer em Configuração')
})

// Divisão Basic/PRO (2026-09-23): a dona do produto manteve os nomes e a ordem
// de sempre no menu. Só mudou: Vendas virou PRO (cadeado) e Minha conta entrou
// no fim do grupo Conta.
test('rótulos do protótipo não voltam ao menu', () => {
  for (const label of ['Vendas Shopee', 'Filas de ofertas', 'IDs de afiliado', "label: 'Mensagens'", "label: 'WhatsApp'"]) {
    assert.ok(!navSource.includes(label.startsWith('label') ? label : `label: '${label}'`), `rótulo "${label}" voltou ao menu`)
  }
  for (const title of ['Divulgar', 'Automatizar', 'Configurar']) {
    assert.ok(!navSource.includes(`title: '${title}'`), `grupo "${title}" voltou ao menu`)
  }
})

test('Vendas é item PRO e Minha conta fecha o grupo Conta', () => {
  const vendas = navSource.indexOf("label: 'Vendas'")
  assert.match(navSource.slice(vendas, vendas + 120), /pro: true/)
  const conta = navSource.slice(navSource.indexOf("title: 'Conta'"))
  const labels = [...conta.matchAll(/label: '([^']+)'/g)].map(m => m[1])
  assert.deepEqual(labels, ['Plano', 'Afiliados', 'Minha conta'])
})
