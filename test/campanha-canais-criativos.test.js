// Criativos finais da campanha Canais + Preservação (P2, 29/09/2026):
// docs/marketing/canais-antiban/criativos/. Guarda para edição futura não
// reintroduzir nome antigo, promessa ou recurso inexistente, nem link quebrado.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const raiz = new URL('..', import.meta.url)
const dir = new URL('docs/marketing/canais-antiban/criativos/', raiz)
const posts = fs.readdirSync(dir).filter((f) => /^post\d{2}-.*\.md$/.test(f)).sort()

const PROIBIDO = [
  [/botinho/i, 'marca única: Espelha Grupos'],
  [/100\s?%|n[ãa]o bane|nunca (?:será )?banid|anti-?ban garantid/i, 'promessa de não-banimento'],
  [/pausa preventiva|rastreio de cliques|conta observadora|painel de saúde|monitoramento de sinais/i, 'recurso que o produto não tem (docs/rca/seo-marketing.md, 24/09)'],
]

test('8 posts, cada um com capa SVG 1080×1080', () => {
  assert.equal(posts.length, 8)
  for (const md of posts) {
    const svg = md.replace(/\.md$/, '.svg')
    const fonte = fs.readFileSync(new URL(svg, dir), 'utf8')
    assert.match(fonte, /width="1080" height="1080"/, svg)
    assert.match(fonte, /<desc id="d">[^<]{20,}<\/desc>/, `${svg}: sem descrição acessível`)
  }
})

test('copy sem nome antigo, promessa ou recurso inexistente; X dentro de 280', () => {
  for (const md of posts) {
    const texto = fs.readFileSync(new URL(md, dir), 'utf8')
    for (const [re, motivo] of PROIBIDO) assert.doesNotMatch(texto, re, `${md}: ${motivo}`)
    for (const m of texto.matchAll(/\*\*(X[^*]*|Post[^*]*|Legenda|Alt text)\*\* — (\d+)\/(\d+) caracteres/g)) {
      assert.ok(Number(m[2]) <= Number(m[3]), `${md}: ${m[1]} passou do limite (${m[2]}/${m[3]})`)
    }
  }
})

test('links com UTM do padrão (social-organic, canais-preservacao) para rota que existe', () => {
  for (const md of posts) {
    const texto = fs.readFileSync(new URL(md, dir), 'utf8')
    const links = [...texto.matchAll(/https:\/\/espelhagrupos\.com\.br(\/[^\s?`)]*)\?([^\s`)]+)/g)]
    assert.ok(links.length >= 3, `${md}: faltam links rastreáveis`)
    for (const [, caminho, query] of links) {
      const p = new URLSearchParams(query)
      assert.equal(p.get('utm_medium'), 'social-organic', md)
      assert.equal(p.get('utm_campaign'), 'canais-preservacao', md)
      assert.ok(['linkedin', 'instagram', 'x'].includes(p.get('utm_source')), md)
      assert.equal(p.get('utm_content'), md.replace(/\.md$/, ''), md)
      assert.ok(fs.existsSync(new URL(`dashboard/app${caminho}/page.js`, raiz)), `${md}: ${caminho} não existe (ou é rota antiga com redirect)`)
    }
  }
})
