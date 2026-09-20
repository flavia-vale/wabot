// Guarda da decisão de 19/09/2026 (dona do produto): o nome antigo do produto
// sai de TODA superfície pública — do texto e do endereço.
//
// Contexto: em 11/09 seis páginas passaram a emparelhar o nome antigo com o
// atual ("X é o nome do robô do Espelha Grupos") porque o ChatGPT tratava os
// dois como concorrentes; três das quatro IAs medidas leem o nome antigo
// solto como calçado infantil. A regra escolhida em 19/09 é escrever SÓ
// "Espelha Grupos". A ligação com citações antigas fica no schema
// (`alternateName`) e na linha de "nome anterior" do llms.txt — e em mais
// lugar nenhum.
//
// As cinco rotas que carregavam o nome antigo no endereço foram renomeadas no
// mesmo dia, com redirect permanente. Este arquivo exige que cada rota antiga
// tenha o seu redirect e que o destino exista no registro SEO — sem isso, o
// pouco histórico que havia (27 impressões, 1 clique) some em silêncio.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getAllSeoRoutes } from '../dashboard/lib/seo-registry.mjs'
import { LEGACY_ROUTE_REDIRECTS } from '../dashboard/next.config.mjs'
import { BRAND_LEGACY_NAME, BRAND_SAME_AS, FOUNDER_SAME_AS } from '../dashboard/lib/marketing-content.js'

const raiz = new URL('..', import.meta.url).pathname
const NOME_ANTIGO = BRAND_LEGACY_NAME
const NOME_ANTIGO_NA_URL = NOME_ANTIGO.toLowerCase()

// Área logada não é superfície pública: lá a pessoa já sabe onde está.
const DIRS_LOGADOS = new Set(['admin', 'painel', 'login', 'api', 'esqueci-senha', 'nova-senha'])

function arquivosPublicos() {
  const out = []
  const walk = (dir, topo) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entrada.name)
      if (entrada.isDirectory()) {
        if (topo && DIRS_LOGADOS.has(entrada.name)) continue
        walk(p, false)
      } else if (/\.(js|jsx|mjs)$/.test(entrada.name)) out.push(p)
    }
  }
  walk(path.join(raiz, 'dashboard/app'), true)
  walk(path.join(raiz, 'dashboard/components'), false)
  out.push(path.join(raiz, 'dashboard/lib/lp-config.mjs'))
  return out
}

test('nenhuma superfície pública escreve o nome antigo — nem sozinho, nem emparelhado', () => {
  const ofensores = []
  for (const arquivo of arquivosPublicos()) {
    const texto = fs.readFileSync(arquivo, 'utf8')
    if (texto.includes(NOME_ANTIGO)) ofensores.push(path.relative(raiz, arquivo))
  }
  assert.deepEqual(ofensores, [], `o nome antigo voltou ao texto público em: ${ofensores.join(', ')}`)
})

test('nenhuma rota do registro SEO carrega o nome antigo no endereço', () => {
  const comNomeAntigo = getAllSeoRoutes().map((r) => r.path).filter((p) => p.toLowerCase().includes(NOME_ANTIGO_NA_URL))
  assert.deepEqual(comNomeAntigo, [])
})

test('nenhum link interno aponta para as rotas antigas', () => {
  const antigas = LEGACY_ROUTE_REDIRECTS.map((r) => r.source)
  const ofensores = []
  const alvos = [...arquivosPublicos(), path.join(raiz, 'dashboard/public/llms.txt'), path.join(raiz, 'dashboard/public/pricing.md')]
  for (const arquivo of alvos) {
    const texto = fs.readFileSync(arquivo, 'utf8')
    for (const antiga of antigas) {
      if (texto.includes(`${antiga}'`) || texto.includes(`${antiga}"`) || texto.includes(`espelhagrupos.com.br${antiga}`)) {
        ofensores.push(`${path.relative(raiz, arquivo)} → ${antiga}`)
      }
    }
  }
  assert.deepEqual(ofensores, [])
})

test('cada rota antiga tem redirect permanente para uma rota que existe no registro SEO', () => {
  const rotas = new Set(getAllSeoRoutes().map((r) => r.path))
  const esperadas = [
    '/bot-comum-vs-botinho',
    '/como-funciona-botinho-canais',
    '/protecao-antiban-botinho',
    '/botinho-vs-planilha-manual',
    '/botinho-vs-ferramentas-genericas-automacao',
  ]
  const fontes = LEGACY_ROUTE_REDIRECTS.map((r) => r.source)
  for (const antiga of esperadas) assert.ok(fontes.includes(antiga), `${antiga} sem redirect em next.config.mjs`)
  for (const { source, destination } of LEGACY_ROUTE_REDIRECTS) {
    assert.ok(rotas.has(destination), `${source} redireciona para ${destination}, que não existe no registro SEO`)
    assert.ok(fs.existsSync(path.join(raiz, 'dashboard/app', destination.slice(1), 'page.js')), `${destination} sem page.js`)
    assert.ok(!destination.toLowerCase().includes(NOME_ANTIGO_NA_URL), `${destination} ainda carrega o nome antigo`)
  }
})

test('o nome antigo continua no schema como alternateName (é o que liga as citações antigas à entidade)', () => {
  const layout = fs.readFileSync(path.join(raiz, 'dashboard/app/layout.js'), 'utf8')
  assert.match(layout, /alternateName:\s*\[BRAND_LEGACY_NAME\]/)
})

test('o Instagram @espelhagrupos está no sameAs da Organization', () => {
  assert.ok(BRAND_SAME_AS.includes('https://www.instagram.com/espelhagrupos'), `sameAs: ${BRAND_SAME_AS.join(', ')}`)
})

test('TikTok @espelhagrupos e a página da empresa no LinkedIn estão no sameAs da Organization', () => {
  assert.ok(BRAND_SAME_AS.includes('https://www.tiktok.com/@espelhagrupos'), `sameAs: ${BRAND_SAME_AS.join(', ')}`)
  assert.ok(
    BRAND_SAME_AS.includes('https://www.linkedin.com/company/145208936/'),
    `sameAs: ${BRAND_SAME_AS.join(', ')}`,
  )
})

test('o LinkedIn pessoal da fundadora está no sameAs da Person', () => {
  assert.ok(
    FOUNDER_SAME_AS.includes('https://www.linkedin.com/in/flaviavale/'),
    `sameAs: ${FOUNDER_SAME_AS.join(', ')}`,
  )
})
