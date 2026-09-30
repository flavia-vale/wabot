import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Bing Webmaster (29/09/2026) acusou "Título muito longo" em /precos: o título
// entregue (com o sufixo de marca do layout) tinha 78 chars e o teto do Bing é
// 70. Na varredura do sitemap, outras 28 páginas também passavam; todas foram
// encurtadas. Guarda: nenhum título de página escrito à mão volta a passar de
// 70 chars depois do sufixo. Título `absolute` não leva sufixo.
const SUFIXO_TEMPLATE = ' | Espelha Grupos'
const TETO_BING = 70
const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const appDir = join(repoRoot, 'dashboard/app')

// Onde o <title> de página é escrito à mão (mesma lista da guarda de 55 chars
// em test/inbound-titulos-clique.test.js, mais as páginas avulsas):
// - `const title = '...'` no topo de cada page.js;
// - `title: '...'` com 4 espaços nos registros de rota dos módulos e do
//   lp-config. Registro com `titleAbsolute: true` não leva sufixo.
// Fora: `title` de openGraph e textos de card de /conteudos (não são <title>).
const MODULOS = [
  'dashboard/app/_organicNicheLanding.js',
  'dashboard/app/_comparisonContent.js',
  'dashboard/app/_seoHubShared.js',
  'dashboard/app/_preservationCommercialPages.js',
  'dashboard/app/_preservationDecisionPages.js',
  'dashboard/app/blog/_preservationBlogPosts.js',
  'dashboard/lib/lp-config.mjs',
]

function pages(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return ['painel', 'admin', 'api'].includes(nome) ? [] : pages(caminho)
    return nome === 'page.js' ? [caminho] : []
  })
}

test('títulos de página cabem no teto de 70 chars do Bing com o sufixo de marca', () => {
  const estouros = []
  const conferir = (arquivo, titulo) => {
    const entregue = titulo + SUFIXO_TEMPLATE
    if (entregue.length > TETO_BING) estouros.push(`${relative(repoRoot, arquivo)}: "${titulo}" → ${entregue.length} chars`)
  }
  for (const arquivo of pages(appDir)) {
    for (const [, titulo] of readFileSync(arquivo, 'utf8').matchAll(/^const title = '((?:[^'\\]|\\.)*)'/gm)) conferir(arquivo, titulo)
  }
  for (const rel of MODULOS) {
    const arquivo = join(repoRoot, rel)
    const src = readFileSync(arquivo, 'utf8')
    for (const m of src.matchAll(/^ {4}title: '((?:[^'\\]|\\.)*)',?$/gm)) {
      const absoluto = /^\s*titleAbsolute: true/m.test(src.slice(m.index, m.index + 600).split(/\n {2}'[^']+': \{/)[0])
      if (!absoluto) conferir(arquivo, m[1])
    }
  }
  assert.deepEqual(estouros, [], `títulos acima de ${TETO_BING} chars:\n${estouros.join('\n')}`)
})

test('/precos: título entregue cabe no teto de 70 chars do Bing', () => {
  const src = readFileSync(join(appDir, 'precos/page.js'), 'utf8')
  const meta = src.slice(src.indexOf('export const metadata'))
  const title = meta.match(/^\s{2}title: '([^']+)'/m)?.[1]
  assert.ok(title, 'metadata.title de /precos precisa ser uma string literal')
  assert.ok((title + SUFIXO_TEMPLATE).length <= TETO_BING)
})
