// "Melhor para" e "Atualizado em" (PLANO_MAQUINA_DE_VENDAS_IA, 23/09/2026).
// A IA recomenda por adequação ("melhor para <caso>") e pesa frescor; até
// 23/09 só 2 das 11 páginas comerciais tinham o bloco e nenhum template
// comercial mostrava a data. Fonte lida como texto: os módulos do dashboard
// usam JSX e aliases (@/) e não carregam no node puro.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const ler = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const comercial = ler('dashboard/app/_preservationCommercialPages.js')

function bloco(fonte, chave) {
  const inicio = fonte.indexOf(`  '${chave}': {`)
  const fim = fonte.indexOf("\n  '", inicio + 5)
  return fonte.slice(inicio, fim === -1 ? undefined : fim)
}

test('toda página comercial e de loja tem "Melhor para" e "Não é ideal para"', () => {
  const chaves = [...comercial.matchAll(/^  '([a-z-]+)': \{$/gm)].map((m) => m[1])
  assert.ok(chaves.length >= 11)
  for (const chave of chaves) {
    const b = bloco(comercial, chave)
    assert.match(b, /bestFor: \{\s*yes: \[/, `${chave}: sem "Melhor para"`)
    assert.match(b, /\n\s+no: \[/, `${chave}: sem "Não é ideal para"`)
  }
})

test('a FAQ "outras lojas" sai da lista canônica, nunca escrita à mão', () => {
  assert.doesNotMatch(comercial, /'Dá\. Shopee, /)
  assert.match(comercial, /outrasLojas\('Mercado Livre'\)/)
})

test('"Atualizado em" visível nos templates que não mostravam data', () => {
  assert.match(comercial, /Atualizado em <time dateTime=\{dates\.updatedAt\}>/)
  assert.match(ler('dashboard/components/landing/IntroCard.jsx'), /Atualizado em <time dateTime=\{updatedAt\}>/)
  for (const rel of ['dashboard/app/_lpShared.js', 'dashboard/app/_seoHubShared.js', 'dashboard/app/_organicNicheLanding.js', 'dashboard/app/page.js']) {
    assert.match(ler(rel), /updatedAt=\{getEditorialDates\(/, rel)
  }
})
