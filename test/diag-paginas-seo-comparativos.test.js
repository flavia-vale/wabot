// Guarda da ação 5 do PLANO_ACAO_SEO_IA_2026-09-01.
//
// As páginas `/alternativas/*` usam o ComparisonPageTracker, que grava
// `comparison_page_view` com a página no campo `page_slug`. O
// diag-paginas-seo.mjs lia SÓ `organic_page_view` e SÓ os campos
// `page_path`/`path`/`slug` — então a linha inteira de comparativos ficava
// invisível no funil, incluindo `/alternativas/achadinhos-bot`, a página com
// MAIS impressão do site (1.281 em 3 meses).
//
// Na análise de 01/09 isso quase virou a conclusão errada "a página não recebe
// visita". O dado estava no banco; a leitura é que não o alcançava. Este teste
// existe para o buraco não voltar em silêncio — é o tipo de defeito que não
// quebra nada, só faz a decisão seguinte ser tomada com meio mapa.
//
// Puro: lê o fonte do script. Não abre banco (o script importa src/db.js).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const raiz = new URL('..', import.meta.url)
const fonte = fs.readFileSync(new URL('scripts/diag-paginas-seo.mjs', raiz), 'utf8')

function carregarPaginaDoEvento() {
  const corpo = fonte.match(/function paginaDoEvento\(m\) \{[\s\S]*?\n\}/)
  assert.ok(corpo, 'paginaDoEvento sumiu de scripts/diag-paginas-seo.mjs')
  // eslint-disable-next-line no-new-func
  return new Function(`${corpo[0]}; return paginaDoEvento`)()
}

test('paginaDoEvento entende o campo do rastreador de comparação (page_slug)', () => {
  const paginaDoEvento = carregarPaginaDoEvento()

  assert.equal(
    paginaDoEvento({ page_slug: '/alternativas/achadinhos-bot' }),
    '/alternativas/achadinhos-bot',
    'sem ler page_slug, toda a linha /alternativas/ some do funil'
  )
  // Os campos antigos continuam valendo — páginas de templates diferentes
  // preenchem diferente, e o script atende as duas famílias.
  assert.equal(paginaDoEvento({ page_path: '/bot-achadinhos-whatsapp' }), '/bot-achadinhos-whatsapp')
  assert.equal(paginaDoEvento({ path: '/precos' }), '/precos')
  assert.equal(paginaDoEvento({ slug: 'precos' }), '/precos')
  assert.equal(paginaDoEvento({ page_slug: '/x?utm_source=chatgpt.com' }), '/x', 'query não pode virar página nova')
  assert.equal(paginaDoEvento({}), '(sem registro)')
})

test('o script consulta os eventos das páginas de comparação, não só os organic_*', () => {
  for (const evento of [
    'organic_page_view',
    'organic_cta_click',
    'comparison_page_view',
    'comparison_cta_click',
    'comparison_scroll_50',
    'signup_created',
  ]) {
    assert.match(
      fonte,
      new RegExp(`'${evento}'`),
      `o diagnóstico precisa consultar '${evento}' — faltando um deles, a página some do funil sem erro nenhum`
    )
  }
})

test('os eventos de comparação estão nas TRÊS allowlists (senão nada é gravado)', () => {
  // O caminho tem três portas e faltar em qualquer uma descarta o dado em
  // silêncio: o navegador só envia o que está em PUBLIC_PERSISTED_EVENTS, a
  // rota só aceita o que está em PUBLIC_ANALYTICS_EVENTS e o banco só grava o
  // que está em ANALYTICS_EVENTS. Foi assim que organic_page_view e
  // organic_cta_click passaram meses sendo descartados.
  const navegador = fs.readFileSync(new URL('dashboard/lib/analytics.js', raiz), 'utf8')
  const api = fs.readFileSync(new URL('src/analytics.js', raiz), 'utf8')

  for (const evento of ['comparison_page_view', 'comparison_cta_click', 'comparison_scroll_50']) {
    assert.match(navegador, new RegExp(`'${evento}'`), `${evento} precisa estar em dashboard/lib/analytics.js`)
    const ocorrencias = api.split(`'${evento}'`).length - 1
    assert.ok(
      ocorrencias >= 2,
      `${evento} aparece ${ocorrencias}x em src/analytics.js — precisa estar em PUBLIC_ANALYTICS_EVENTS E em ANALYTICS_EVENTS`
    )
  }
})
