import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { getIndexableSeoRoutes } from '../dashboard/lib/seo-registry.mjs'
import { EDITORIAL_DATES } from '../dashboard/lib/editorial-content.js'

const ROUTE = '/clonar-mensagens-de-grupo-de-afiliados'
const source = fs.readFileSync(
  new URL('../dashboard/app/clonar-mensagens-de-grupo-de-afiliados/page.js', import.meta.url),
  'utf8',
)

// A página existe por causa de UMA lacuna medida: a Visão Geral criada por IA
// do Google responde "clonar mensagens de grupo afiliado" listando
// concorrentes, e o site inteiro só falava "espelhar". Se a palavra que a
// pessoa digita sumir do título, a página perde a razão de existir.
test('a página entra pela palavra que o mercado busca', () => {
  const title = source.match(/^const title = '([^']+)'/m)?.[1] ?? ''
  assert.match(title.toLowerCase(), /clonar/)
  assert.match(source, /<h1|title=\{title\}/)
})

test('a rota está no sitemap e tem data editorial', () => {
  const paths = getIndexableSeoRoutes().map((route) => route.path)
  assert.ok(paths.includes(ROUTE))
  assert.ok(EDITORIAL_DATES[ROUTE]?.updatedAt)
})

// Os quatro formatos que uma resposta de IA consegue citar. Perder qualquer um
// deles é perder o motivo pelo qual a página foi escrita nesse formato.
test('emite os schemas que a resposta de IA consome', () => {
  for (const type of ['HowTo', 'ItemList', 'BreadcrumbList']) {
    assert.match(source, new RegExp(`'@type': '${type}'`), `falta schema ${type}`)
  }
  assert.match(source, /buildArticleJsonLd/) // Article + FAQPage
  assert.ok(source.includes('faq,'), 'o FAQ precisa alimentar o FAQPage')
})

// Uso responsável: entrar pela palavra "clonar" não pode virar promessa de
// imunidade a banimento nem incentivo a ler grupo alheio.
test('não promete imunidade nem acesso a grupo fechado', () => {
  const text = source.toLowerCase()
  // "anti-ban garantido" aparece na página, mas para ser NEGADO — por isso o
  // guard mira nas formas afirmativas, não na string solta.
  assert.ok(!/garantimos|nunca será banid|sem risco de banimento|100% seguro/.test(text))
  assert.match(text, /não pode|nenhuma delas pode prometer/)
  assert.match(text, /só lê os grupos|só enxerga o que você enxerga|não de forma legítima/)
})
