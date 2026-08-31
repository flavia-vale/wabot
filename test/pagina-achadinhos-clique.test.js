// Guardas da rodada de 2026-08-17 na página /bot-achadinhos-whatsapp — a página
// com mais impressões do site (529 em 3 meses) e apenas 11 cliques.
//
// Três coisas não podem regredir aqui:
//   1. o funil de SEO precisa ser GRAVÁVEL (as duas primeiras etapas ficaram
//      anos sendo descartadas em silêncio por faltarem numa allowlist);
//   2. o título não pode voltar a estourar o corte do Google no celular, de onde
//      vêm 62% das impressões;
//   3. as duas páginas que atendem a mesma busca precisam continuar
//      diferenciadas e linkadas entre si.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ANALYTICS_EVENTS, PUBLIC_ANALYTICS_EVENTS } from '../src/analytics.js'

const raiz = new URL('..', import.meta.url)
const lerFonte = (caminho) => readFileSync(new URL(caminho, raiz), 'utf8')

// Limite prático do que o Google mostra no celular. O sufixo do template do
// layout (' | Espelha Grupos') entra na conta porque é renderizado junto.
const SUFIXO_TEMPLATE = ' | Espelha Grupos'
const MAX_TITULO_VISIVEL = 60

test('as duas primeiras etapas do funil de SEO são graváveis nas TRÊS allowlists', () => {
  for (const evento of ['organic_page_view', 'organic_cta_click']) {
    // Autoriza a rota pública a aceitar o evento de visitante anônimo.
    assert.equal(PUBLIC_ANALYTICS_EVENTS.has(evento), true, `${evento} fora de PUBLIC_ANALYTICS_EVENTS`)
    // Autoriza a gravação no banco.
    assert.equal(ANALYTICS_EVENTS.has(evento), true, `${evento} fora de ANALYTICS_EVENTS`)
  }

  // Terceira ponta: a allowlist do navegador. Sem ela o evento nunca sai da
  // página — e faltar em qualquer uma das três descarta sem erro nenhum.
  const clientAnalytics = lerFonte('dashboard/lib/analytics.js')
  const bloco = clientAnalytics.slice(
    clientAnalytics.indexOf('PUBLIC_PERSISTED_EVENTS'),
    clientAnalytics.indexOf('export function shouldSuppressConversionPrompt')
  )
  assert.match(bloco, /TRACKING_EVENTS\.ORGANIC_PAGE_VIEW/)
  assert.match(bloco, /TRACKING_EVENTS\.ORGANIC_CTA_CLICK/)
})

test('título de /bot-achadinhos-whatsapp cabe no corte do Google com o sufixo do template', () => {
  const fonte = lerFonte('dashboard/app/_preservationCommercialPages.js')
  const bloco = fonte.slice(fonte.indexOf("'bot-achadinhos-whatsapp': {"))
  const titulo = bloco.match(/title: '([^']+)'/)?.[1]
  assert.ok(titulo, 'não achei o title da página')

  // O que importa é o começo: o motivo para clicar tem que estar dentro da
  // janela visível, não depois dela.
  assert.ok(
    titulo.length <= MAX_TITULO_VISIVEL,
    `título com ${titulo.length} chars (+${SUFIXO_TEMPLATE.length} do sufixo) passa do corte do celular`
  )
  // Diferencial concreto no título, não só a palavra-chave.
  assert.match(titulo, /achadinhos/i)
})

test('descrição de /bot-achadinhos-whatsapp não passa do que o Google exibe', () => {
  const fonte = lerFonte('dashboard/app/_preservationCommercialPages.js')
  const bloco = fonte.slice(fonte.indexOf("'bot-achadinhos-whatsapp': {"))
  const descricao = bloco.match(/description: '([^']+)'/)?.[1]
  assert.ok(descricao, 'não achei a description da página')
  assert.ok(descricao.length <= 160, `description com ${descricao.length} chars é cortada pelo Google`)
})

test('a página comercial aponta para o comparativo do concorrente e o comparativo aponta de volta', () => {
  const comercial = lerFonte('dashboard/app/_preservationCommercialPages.js')
  const blocoComercial = comercial.slice(comercial.indexOf("'bot-achadinhos-whatsapp': {"))

  // Ida: quem buscou o nome do concorrente precisa de comparação, não de botão.
  assert.match(blocoComercial, /competitorNudge:/)
  assert.match(blocoComercial, /\/alternativas\/achadinhos-bot/)
  // O link precisa ser rastreável, senão não há como saber se funcionou.
  assert.match(comercial, /data-seo-cta="commercial_competitor_nudge"/)
  // E precisa ficar ANTES dos botões no hero — orientação vem antes de decisão.
  assert.ok(
    comercial.indexOf('page.competitorNudge') < comercial.indexOf('data-seo-cta="commercial_signup"'),
    'o aviso de comparação tem que vir antes do CTA primário'
  )

  // Volta: sem o par recíproco, o Google não tem como saber qual página
  // responde o quê e continua dividindo o sinal entre as duas.
  const comparativo = lerFonte('dashboard/app/_comparisonContent.js')
  const blocoComparativo = comparativo.slice(comparativo.indexOf("'/alternativas/achadinhos-bot': {"))
  assert.match(blocoComparativo, /productPage:/)
  assert.match(blocoComparativo, /\/bot-achadinhos-whatsapp/)
  assert.match(comparativo, /data-comparison-cta="product-page"/)
})

test('as duas páginas não disputam o mesmo título', () => {
  const comercial = lerFonte('dashboard/app/_preservationCommercialPages.js')
  const comparativo = lerFonte('dashboard/app/_comparisonContent.js')

  const tituloComercial = comercial
    .slice(comercial.indexOf("'bot-achadinhos-whatsapp': {"))
    .match(/title: '([^']+)'/)?.[1]
  const tituloComparativo = comparativo
    .slice(comparativo.indexOf("'/alternativas/achadinhos-bot': {"))
    .match(/title: '([^']+)'/)?.[1]

  // Só o comparativo entra pela marca do concorrente. A comercial responde a
  // busca genérica — foi a sobreposição das duas que dividiu o sinal.
  assert.match(tituloComparativo, /AchadinhosBot/)
  assert.doesNotMatch(tituloComercial, /AchadinhosBot/)
  assert.notEqual(tituloComercial, tituloComparativo)
})

test('o comparativo não renderiza o mesmo bloco duas vezes', () => {
  const comparativo = lerFonte('dashboard/app/_comparisonContent.js')
  // Os blocos "Outros comparativos relacionados", TL;DR e "Caminho de migração"
  // já estiveram duplicados verbatim, e todo visitante lia as seções em dobro.
  // Depois da rodada visual de 2026-08-26 as seções viraram <SectionCard>, então
  // a contagem é por seção, não pelo texto do cabeçalho antigo.
  const vezes = (marcador) => comparativo.split(marcador).length - 1

  assert.equal(vezes('title="Outros comparativos"'), 1, 'bloco de comparativos relacionados duplicado')
  assert.equal(vezes('eyebrow="Resumo rápido"'), 1, 'bloco de resumo rápido (TL;DR) duplicado')
  assert.equal(vezes('id={SECTION_IDS.migracao}'), 1, 'bloco de migração duplicado')
  assert.equal(vezes('id={SECTION_IDS.comparativo}'), 1, 'bloco do comparativo duplicado')
})

test('o comparativo apresenta preço, grupos e as cinco lojas do BOTinho em toda a decisão', () => {
  const comparativo = lerFonte('dashboard/app/_comparisonContent.js')
  const inicio = comparativo.indexOf("'/alternativas/achadinhos-bot': {")
  const fim = comparativo.indexOf("'/alternativas/proafiliados': {", inicio)
  const bloco = comparativo.slice(inicio, fim)

  assert.match(bloco, /R\$ 39 por 30 dias \(grupos ilimitados\)/)
  assert.match(bloco, /Shopee, Amazon, Mercado Livre, Magalu e SHEIN/)
  assert.match(bloco, /productProfile:\s*{[\s\S]*name: 'BOTinho'/)
  assert.match(bloco, /productDefinition: 'O BOTinho é para quem administra grupos/)
  assert.match(bloco, /Qual é mais barato: BOTinho, AchadinhosBot ou Achadinho Pro\?/)
  assert.match(bloco, /Qual bot aceita mais lojas pelo menor preço\?/)
})

test('o texto aprovado usa o layout existente e não cria uma seção visual nova', () => {
  const comparativo = lerFonte('dashboard/app/_comparisonContent.js')

  // Os novos conteúdos entram nos componentes que a página já usava: lista de
  // limites, CompetitorCard e fechamento. Assim a copy muda sem trocar o layout.
  assert.match(comparativo, /page\.limitations \|\| PRODUCT_LIMITATIONS/)
  assert.match(comparativo, /page\.productProfile && <CompetitorCard/)
  assert.match(comparativo, /page\.productDefinition \|\| PRODUCT_DEFINITION/)
})
