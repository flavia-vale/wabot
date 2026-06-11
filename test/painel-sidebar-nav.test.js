import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const navSource = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')

function groupBlock(title, nextTitle) {
  const start = navSource.indexOf(`title: '${title}'`)
  const end = navSource.indexOf(`title: '${nextTitle}'`, start)
  assert.notEqual(start, -1, `grupo ${title} deve existir`)
  assert.notEqual(end, -1, `grupo ${nextTitle} deve vir após ${title}`)
  return navSource.slice(start, end)
}

test('sidebar keeps Criar oferta inside Criar & enviar before Espelhar grupos', () => {
  const block = groupBlock('Criar & enviar', 'Acompanhar')
  const criarOferta = block.indexOf("label: 'Criar oferta'")
  const espelharGrupos = block.indexOf("label: 'Espelhar grupos'")

  assert.notEqual(criarOferta, -1, 'Criar oferta deve ser um item do grupo Criar & enviar')
  assert.notEqual(espelharGrupos, -1, 'Espelhar grupos deve ser um item do grupo Criar & enviar')
  assert.ok(criarOferta < espelharGrupos, 'Criar oferta deve vir antes de Espelhar grupos')
})

test('sidebar points Criar oferta to its route and gates pro features instead of top CTA highlight', () => {
  const block = groupBlock('Criar & enviar', 'Acompanhar')
  const criarOfertaItem = block.slice(block.indexOf("label: 'Criar oferta'"), block.indexOf("label: 'Espelhar grupos'"))

  assert.match(criarOfertaItem, /href:\s*'\/painel\/criar-oferta'/, 'Criar oferta deve apontar para a rota atual')
  assert.doesNotMatch(criarOfertaItem, /pro:\s*true/, 'Criar oferta deve permanecer acessível sem plano pro')

  const espelharItem = block.slice(block.indexOf("label: 'Espelhar grupos'"), block.indexOf("label: 'Ofertas automáticas'"))
  assert.match(espelharItem, /pro:\s*true/, 'Espelhar grupos deve declarar gate pro')

  assert.doesNotMatch(shellSource, /<Link href=\{TOP_CTA\.href\}/, 'não deve haver CTA destacado no topo da sidebar')
})
