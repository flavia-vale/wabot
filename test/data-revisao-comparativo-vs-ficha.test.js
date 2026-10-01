// "Revisado em" de um comparativo nunca pode ser mais velho que a ficha do
// concorrente que a página mostra (01/10/2026).
//
// Em 27/09 a /alternativas/proafiliados foi reescrita com a ficha nova
// ("Verificado em 27/09/2026" no texto), mas a data em EDITORIAL_DATES ficou
// em 04/08 — e o "Revisado em", o dateModified e o lastmod do sitemap
// continuaram dizendo 04/08 para o Google e as IAs. Data vem do conteúdo:
// mudou a ficha que a página exibe, a página mudou.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { listCompetitors } from '../dashboard/lib/competitors-data.js'
import { EDITORIAL_DATES } from '../dashboard/lib/editorial-content.js'

const fonte = fs.readFileSync(new URL('../dashboard/app/_comparisonContent.js', import.meta.url), 'utf8')

function paginasComFicha() {
  const paginas = []
  const re = /^  '(\/[^']+)': \{$/gm
  const inicios = [...fonte.matchAll(re)]
  inicios.forEach((m, i) => {
    const bloco = fonte.slice(m.index, inicios[i + 1]?.index)
    const slugs = bloco.match(/competitorSlugs: \[([^\]]*)\]/)
    if (!slugs) return
    paginas.push({ path: m[1], slugs: [...slugs[1].matchAll(/'([^']+)'/g)].map((s) => s[1]) })
  })
  return paginas
}

test('comparativos: a data da página não é mais velha que a ficha que ela exibe', () => {
  const fichas = new Map(listCompetitors().map((c) => [c.slug, c]))
  const paginas = paginasComFicha()
  assert.ok(paginas.length >= 20, `achou só ${paginas.length} páginas com competitorSlugs`)
  const atrasadas = []
  for (const { path, slugs } of paginas) {
    const datas = EDITORIAL_DATES[path]
    assert.ok(datas, `${path}: sem data em EDITORIAL_DATES`)
    for (const slug of slugs) {
      const ficha = fichas.get(slug)
      assert.ok(ficha, `${path}: ficha ${slug} não existe`)
      if (datas.updatedAt < ficha.verifiedAt) atrasadas.push(`${path} revisado ${datas.updatedAt} < ficha ${slug} ${ficha.verifiedAt}`)
    }
  }
  assert.deepEqual(atrasadas, [])
})
