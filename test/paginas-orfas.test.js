// Guarda da ação 8 do PLANO_ACAO_SEO_IA_2026-09-01.
//
// Quatro páginas CAÍRAM do índice do Google depois de já terem ranqueado, entre
// elas /padronizar-divulgacao-afiliado-whatsapp, que tinha o MELHOR CTR do site
// (9,68%, 31 impressões e 3 cliques).
//
// A investigação descartou as causas óbvias: as quatro estão com
// `indexable: true`, entram no sitemap, têm `priority` 0.9 e o mesmo tamanho de
// conteúdo das seis irmãs que continuaram indexadas. Nada no código separa as
// que caíram das que ficaram.
//
// O que a investigação ACHOU foi outra coisa, maior: seis das dez LPs de "dor"
// não são citadas em ponto NENHUM do site — nem por link estático, nem por link
// montado dinamicamente. Existiam só no sitemap. Página que só existe no
// sitemap é a causa clássica de "rastreada, mas não indexada", que é o estado
// de 26 páginas nossas no relatório de Cobertura.
//
// Este teste não prova por que as quatro caíram — isso exige a Inspeção de URL
// no Search Console, que é ação humana. Ele impede que a família volte a ficar
// órfã.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SEO_ROUTES } from '../dashboard/lib/seo-registry.mjs'

const raiz = new URL('..', import.meta.url)
const hub = fs.readFileSync(new URL('dashboard/app/conteudos/page.js', raiz), 'utf8')

const LPS_DE_DOR = SEO_ROUTES.filter((rota) => rota.template === 'programmatic-lp' && rota.indexable)

test('a varredura cobre as dez LPs de dor conhecidas', () => {
  assert.ok(
    LPS_DE_DOR.length >= 10,
    `esperava ao menos 10 LPs de dor indexáveis no registry, achei ${LPS_DE_DOR.length}`
  )
})

test('nenhuma LP de dor fica só no sitemap — todas têm caminho a partir do hub de conteúdos', () => {
  const semLink = LPS_DE_DOR.filter((rota) => !hub.includes(`'${rota.path}'`))
  assert.deepEqual(
    semLink.map((rota) => rota.path),
    [],
    'estas rotas existem no sitemap e não são alcançáveis por link nenhum do site. ' +
      'Foi assim que quatro páginas desta família caíram do índice, incluindo a de melhor CTR do site.'
  )
})

test('as quatro que caíram do índice seguem indexáveis e no sitemap', () => {
  // Se alguém marcar uma delas como não-indexável para "resolver" o problema,
  // o conserto vira o próprio defeito: a página some de vez em vez de voltar.
  const CAIRAM = [
    '/padronizar-divulgacao-afiliado-whatsapp',
    '/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo',
    '/reduzir-tempo-operacional-em-grupos-whatsapp',
    '/rastrear-resultados-de-divulgacao-em-grupos',
  ]
  for (const caminho of CAIRAM) {
    const rota = SEO_ROUTES.find((r) => r.path === caminho)
    assert.ok(rota, `${caminho} sumiu do registry`)
    assert.equal(rota.indexable, true, `${caminho} precisa continuar indexável para poder voltar ao índice`)
  }
})
