// Guardas da rodada visual de 2026-08-26 nas páginas de comparativo
// (/alternativas/*). Duas coisas motivaram a rodada e não podem regredir:
//
//   1. LEITURA — a página era uma pilha de ~12 cartões idênticos, na ordem
//      errada ("Veja também" antes do próprio comparativo) e com a seção de
//      migração renderizada duas vezes. A tabela de 3 colunas era ilegível no
//      celular, de onde vêm 62% das impressões do site.
//   2. CLIQUE — a página inteira tinha só dois pontos de clique (topo e
//      rodapé), rotulados "Entrar na Lista VIP". Quem decidia no meio da
//      tabela não tinha para onde ir, e o rótulo não dizia que o teste é
//      grátis.
//
// A duplicação de bloco continua guardada em pagina-achadinhos-clique.test.js.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const raiz = new URL('..', import.meta.url)
const lerFonte = (caminho) => fs.readFileSync(new URL(caminho, raiz), 'utf8')

const conteudo = () => lerFonte('dashboard/app/_comparisonContent.js')
const secoes = () => lerFonte('dashboard/components/marketing/ComparisonSections.jsx')
const css = () => lerFonte('dashboard/app/landing.css')

test('a página tem pelo menos 4 chamadas para o teste grátis ao longo da leitura', () => {
  const ctas = [...conteudo().matchAll(/<TrialCta\b/g)].length
  assert.ok(
    ctas >= 4,
    `só ${ctas} chamadas para o teste no corpo da página — a leitura é longa e quem decide no meio precisa de um ponto de clique perto`
  )
})

test('a barra fixa de teste grátis existe e só aparece no celular', () => {
  assert.match(conteudo(), /<StickyTrialCta\b/, 'a barra fixa saiu da página')
  const folha = css()
  assert.match(folha, /\.comparison-sticky-cta \{\s*display: none;/, 'a barra fixa precisa nascer escondida')
  assert.match(folha, /@media \(max-width: 768px\)[\s\S]*\.comparison-sticky-cta \{[\s\S]*display: flex;/, 'a barra fixa não é ligada no celular')
  // Sem o respiro embaixo, a barra cobre o rodapé.
  assert.match(conteudo(), /comparison-has-sticky/)
  assert.match(folha, /\.comparison-has-sticky \{ padding-bottom:/)
})

test('todo botão de teste grátis é rastreável e fala em teste grátis, não em lista de espera', () => {
  const fonteSecoes = secoes()

  // O ComparisonPageTracker escuta [data-comparison-cta]; botão sem o atributo
  // é clique que ninguém consegue medir depois.
  assert.match(fonteSecoes, /data-comparison-cta=\{content\}/)
  assert.match(fonteSecoes, /data-comparison-cta="sticky-mobile"/)

  // O gatilho está no rótulo: "grátis" precisa aparecer no texto do botão.
  assert.match(fonteSecoes, /TRIAL_LABEL = '[^']*gr[áa]tis'/i)
  for (const arquivo of ['dashboard/app/_comparisonContent.js', 'dashboard/components/marketing/ComparisonSections.jsx']) {
    assert.doesNotMatch(
      lerFonte(arquivo),
      /Lista VIP/i,
      `${arquivo}: "Lista VIP" não diz que o teste é grátis — o rótulo é o gatilho do clique`
    )
  }

  // O destino precisa carregar atribuição, senão o cadastro parece orgânico.
  assert.match(fonteSecoes, /buildRegisterHref/)
})

test('a tabela do comparativo vira cartão no celular', () => {
  // Cada célula carrega o rótulo da coluna para o cabeçalho poder sumir.
  assert.match(secoes(), /data-label=\{headers\[1\]\}/)
  assert.match(css(), /\.comparison-table tbody td::before \{\s*content: attr\(data-label\);/)
})

test('a página não volta a nomear concorrente que não é o da página no título dos diferenciais', () => {
  // O cabeçalho era fixo e citava cinco ferramentas que nada tinham a ver com
  // a página aberta, em toda página de comparativo.
  //
  // ⚠️ A varredura é só do CÓDIGO DE RENDERIZAÇÃO, nunca do arquivo inteiro.
  // Até 2026-09-17 ela olhava o arquivo todo, e isso funcionava só porque
  // nenhum desses concorrentes tinha página própria. Quando o Divulgador
  // Inteligente e o DivulgaLinks ganharam a sua, o nome deles passou a aparecer
  // legitimamente DENTRO do próprio bloco — que é exatamente o lugar certo — e
  // a guarda reprovou o acerto. O que ela protege é o texto COMPARTILHADO entre
  // todas as páginas; é ele que não pode nomear ninguém.
  const fonte = conteudo()
  const corte = fonte.indexOf('export function getComparisonMetadata')
  assert.ok(corte > 0, 'não achei o fim do bloco de dados por página em _comparisonContent.js')
  const renderizacao = fonte.slice(corte)

  assert.doesNotMatch(fonte, /Veja como nos comparamos com/)
  assert.doesNotMatch(renderizacao, /Divulgador Inteligente|Divulga Ninja|Busqy|DivulgaLinks/)
})

test('o comparativo aparece antes dos links de saída', () => {
  const fonte = conteudo()
  assert.ok(
    fonte.indexOf('id={SECTION_IDS.comparativo}') < fonte.indexOf('title="Outros comparativos"'),
    'os links para outras páginas voltaram para antes do comparativo — quem chegou para comparar sai antes de comparar'
  )
})
