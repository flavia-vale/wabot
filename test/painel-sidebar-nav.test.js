import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Divisão Basic/PRO (2026-09-23): o menu segue o protótipo aprovado pela dona
// do produto — Divulgar → Automatizar → Configurar → (Preservação) → Conta.

const navSource = readFileSync(new URL('../dashboard/app/painel/nav.js', import.meta.url), 'utf8')
const shellSource = readFileSync(new URL('../dashboard/app/painel/PainelShell.js', import.meta.url), 'utf8')

function block(title, nextTitle) {
  const start = navSource.indexOf(`title: '${title}'`)
  const end = nextTitle ? navSource.indexOf(`title: '${nextTitle}'`, start) : navSource.length
  assert.notEqual(start, -1, `grupo ${title} deve existir`)
  assert.notEqual(end, -1, `grupo ${nextTitle} deve vir depois de ${title}`)
  return navSource.slice(start, end)
}

function labels(text) {
  return [...text.matchAll(/label: '([^']+)'/g)].map(m => m[1])
}

test('grupos na ordem do protótipo', () => {
  const titles = [...navSource.matchAll(/title: '([^']+)'/g)].map(m => m[1])
  assert.deepEqual(titles, ['Divulgar', 'Automatizar', 'Configurar', 'Preservação avançada', 'Conta'])
})

test('Divulgar: Painel, Criar oferta, Enviar agora, Envios, Filas de ofertas e Vendas Shopee', () => {
  assert.deepEqual(labels(block('Divulgar', 'Automatizar')), ['Painel', 'Criar oferta', 'Enviar agora', 'Envios', 'Filas de ofertas', 'Vendas Shopee'])
})

test('Automatizar e Configurar', () => {
  assert.deepEqual(labels(block('Automatizar', 'Configurar')), ['Espelhamento', 'Ofertas automáticas'])
  assert.deepEqual(labels(block('Configurar', 'Preservação avançada')), ['Mensagens', 'IDs de afiliado', 'Testar conversão', 'WhatsApp', 'Tutorial'])
})

test('Conta tem Plano, Minha conta e Afiliados', () => {
  assert.deepEqual(labels(block('Conta')), ['Plano', 'Minha conta', 'Afiliados'])
})

test('os itens do PRO são exatamente Filas, Vendas, Ofertas automáticas e a Preservação', () => {
  const pro = []
  for (const m of navSource.matchAll(/label: '([^']+)',\n\s+href: '[^']+',\n\s+pro: true/g)) pro.push(m[1])
  assert.deepEqual(pro.sort(), ['Configurações avançadas', 'Filas de ofertas', 'Monitoramento', 'Ofertas automáticas', 'Preservação por grupo e canal', 'Vendas Shopee'].sort())
})

test('cadeado PRO só aparece para quem não tem o PRO, e o item continua clicável', () => {
  assert.match(shellSource, /item\.pro && !isPro/)
  assert.match(shellSource, /is-pro-locked/)
  assert.match(shellSource, /item\.free\s*&&\s*<span className="pnl-free">GRÁTIS<\/span>/, 'shell deve preservar suporte ao badge GRÁTIS')
})

test('a marca do painel é Espelha Grupos', () => {
  assert.match(shellSource, /className="pnl-brand"[\s\S]{0,120}Espelha Grupos/)
  assert.doesNotMatch(shellSource, /BOTinho <small>/)
})
