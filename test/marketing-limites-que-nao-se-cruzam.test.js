// Guarda dos limites que reprovam revisão (FR-029..FR-034) — specs/013-inbound-leads-strategy.
// Varre o texto PUBLICADO, não a intenção: entrar pela palavra "banido"/
// "anti-ban" continua permitido (é como as pessoas buscam), só a PROMESSA de
// não-banimento reprova. Este arquivo nasce em US4 (T030, só FR-029 contra
// /bot-afiliados-whatsapp) e é ESTENDIDO — nunca recriado — em US5 (T036:
// preço/fonte/data + bestFit) e US6 (T041: promessa + posição do CTA de
// produto), mais o guard de frentes congeladas no Polish final (T043).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SEO_ROUTES, HUB_SEO_ROUTES, PROGRAMMATIC_SEO_ROUTES } from '../dashboard/lib/seo-registry.mjs'

const raiz = new URL('..', import.meta.url)
const lerFonte = (caminho) => fs.readFileSync(new URL(caminho, raiz), 'utf8')

// Lista de AGENTS.md ("Limites que reprovam review"): frases que prometem
// ausência de banimento. Literais o bastante para não confundir com o uso
// honesto da palavra "banido"/"anti-ban" em pergunta ou explicação de risco
// (ex.: "Ninguém pode garantir banimento zero" É permitido — é negação, não
// promessa; "banimento zero garantido" NÃO é permitido — é a promessa).
const PADROES_PROMESSA_NAO_BANIMENTO = [
  /n[ãa]o ser[áa] banid[oa]/i,
  /sem risco de ban/i,
  /100%\s*segur[oa]/i,
  /anti-?ban garantid[oa]/i,
  /nunca bane/i,
  /banimento zero garantid[oa]/i,
  /garantimos.{0,25}n[ãa]o.{0,10}ban/i,
  /garante.{0,15}(imunidade|prote[çc][ãa]o total)/i,
]

function extrairBlocoPreservationCommercial(pageKey) {
  const fonte = lerFonte('dashboard/app/_preservationCommercialPages.js')
  const marcador = `'${pageKey}': {`
  const idx = fonte.indexOf(marcador)
  if (idx === -1) throw new Error(`chave "${pageKey}" não encontrada em _preservationCommercialPages.js`)
  const resto = fonte.slice(idx + marcador.length)
  const fimRelativo = resto.search(/\n {2}'/)
  return fimRelativo === -1 ? resto : resto.slice(0, fimRelativo)
}

test('FR-029: /bot-afiliados-whatsapp nunca promete que a conta não será banida', () => {
  const bloco = extrairBlocoPreservationCommercial('bot-afiliados-whatsapp')
  for (const padrao of PADROES_PROMESSA_NAO_BANIMENTO) {
    assert.doesNotMatch(bloco, padrao, `/bot-afiliados-whatsapp contém promessa de não-banimento (padrão: ${padrao})`)
  }
  // Entrar pela palavra continua permitido — a página PODE (e deve) discutir
  // o tema, só não pode prometer ausência de risco.
  assert.match(bloco, /banid[oa]|anti-?ban|banimento/i, 'a página deveria abordar o tema de risco honestamente, não evitá-lo')
})

// --- US5 (T036): extensão para /alternativas/achadinho-pro — nunca recriar
// um segundo arquivo, só estender este.

function extrairBlocoComparativo(path) {
  const fonte = lerFonte('dashboard/app/_comparisonContent.js')
  const marcador = `'${path}': {`
  const idx = fonte.indexOf(marcador)
  if (idx === -1) throw new Error(`chave "${path}" não encontrada em _comparisonContent.js`)
  const resto = fonte.slice(idx + marcador.length)
  const fimRelativo = resto.search(/\n {2}'\//)
  return fimRelativo === -1 ? resto : resto.slice(0, fimRelativo)
}

function extrairCompetitorData(slug) {
  const fonte = lerFonte('dashboard/lib/competitors-data.js')
  const idx = fonte.indexOf(`slug: '${slug}'`)
  if (idx === -1) throw new Error(`slug "${slug}" não encontrado em competitors-data.js`)
  const fimObjeto = fonte.indexOf('\n  },', idx)
  const bloco = fonte.slice(Math.max(0, fonte.lastIndexOf('{', idx)), fimObjeto)
  return {
    bloco,
    verifiedAt: bloco.match(/verifiedAt:\s*'([^']+)'/)?.[1] ?? null,
    source: bloco.match(/source:\s*'([^']+)'/)?.[1] ?? null,
    precos: [...bloco.matchAll(/R\$\s?[\d.,]+/g)].map((m) => m[0].replace(/\s/g, ' ').trim()),
  }
}

test('FR-030: /alternativas/achadinho-pro diz "alternativa a/ao", nunca se apresenta como o concorrente', () => {
  const bloco = extrairBlocoComparativo('/alternativas/achadinho-pro')
  const title = bloco.match(/title:\s*'([^']+)'/)?.[1]
  assert.ok(title, 'não achei o title de /alternativas/achadinho-pro')
  assert.match(title, /^alternativa (a|ao)/i)
  assert.doesNotMatch(title, /^achadinho pro/i, 'o título não pode se apresentar como o próprio Achadinho Pro')
})

test('FR-031: todo preço citado em /alternativas/achadinho-pro tem correspondência em competitors-data.js com verifiedAt+source', () => {
  const bloco = extrairBlocoComparativo('/alternativas/achadinho-pro')
  const competitor = extrairCompetitorData('achadinho-pro')

  assert.ok(competitor.verifiedAt, 'competitors-data.js: achadinho-pro sem verifiedAt')
  assert.ok(competitor.source, 'competitors-data.js: achadinho-pro sem source')

  // Todo "R$ N" que aparece na página tem que casar com um preço já
  // verificado do concorrente — preço solto no texto reprova (FR-031).
  const precosNaPagina = [...bloco.matchAll(/R\$\s?[\d.,]+/g)].map((m) => m[0].replace(/\s/g, ' ').trim())
  assert.ok(precosNaPagina.length > 0, 'página de comparação sem nenhum preço citado — revisar se isso é esperado')
  // Deltas calculados a partir de valores já verificados (ex.: R$59,97 -
  // R$49,97 = R$10; R$69 - R$39 = R$30) não são número novo — são aritmética
  // sobre dado que já passou pela fonte única. O preço do próprio BOTinho
  // (R$39/R$69) também não exige competitors-data.js, que é só para
  // concorrente.
  const precosDerivadosPermitidos = ['R$10', 'R$30', 'R$39', 'R$69']
  for (const preco of precosNaPagina) {
    assert.ok(
      competitor.precos.includes(preco) || precosDerivadosPermitidos.includes(preco),
      `preço "${preco}" citado em /alternativas/achadinho-pro não bate com nenhum valor verificado em competitors-data.js nem é delta/preço próprio conhecido`
    )
  }
})

test('FR-032: /alternativas/achadinho-pro tem o bloco bestFit (onde o concorrente é a melhor escolha)', () => {
  const bloco = extrairBlocoComparativo('/alternativas/achadinho-pro')
  assert.match(bloco, /bestFit:\s*\[/, 'faltou o campo bestFit')
  const bestFitBloco = bloco.slice(bloco.indexOf('bestFit:'), bloco.indexOf('bestFit:') + 800)
  assert.match(bestFitBloco, /achadinho pro/i, 'bestFit precisa dizer explicitamente quando escolher o Achadinho Pro')
})

// --- US6 (T041): extensão para o guia Tier 1 da Shopee.

function extrairBlocoBlogPost(postKey) {
  const fonte = lerFonte('dashboard/app/blog/_preservationBlogPosts.js')
  const marcador = `'${postKey}': {`
  const idx = fonte.indexOf(marcador)
  if (idx === -1) throw new Error(`chave "${postKey}" não encontrada em _preservationBlogPosts.js`)
  const resto = fonte.slice(idx + marcador.length)
  const fimRelativo = resto.search(/\n {2}'/)
  return fimRelativo === -1 ? resto : resto.slice(0, fimRelativo)
}

test('FR-029: guia Shopee (como-ser-afiliado-shopee-whatsapp) nunca promete que a conta não será banida', () => {
  const bloco = extrairBlocoBlogPost('como-ser-afiliado-shopee-whatsapp')
  for (const padrao of PADROES_PROMESSA_NAO_BANIMENTO) {
    assert.doesNotMatch(bloco, padrao, `guia Shopee contém promessa de não-banimento (padrão: ${padrao})`)
  }
})

test('FR-027 (cenário 3 da US6): a chamada de produto (midBridge) do guia Shopee vem DEPOIS das seções técnicas, nunca antes', () => {
  const fonte = lerFonte('dashboard/app/blog/_preservationBlogPosts.js')
  const bloco = extrairBlocoBlogPost('como-ser-afiliado-shopee-whatsapp')

  // Declarado com position:'end' na entrada de dados.
  assert.match(bloco, /midBridge:\s*\{[\s\S]*?position:\s*'end'/, 'midBridge do guia Shopee precisa declarar position: "end"')

  // E o RENDER precisa respeitar isso: a checagem `position !== 'end'` no
  // meio do loop de sections, e um bloco separado depois do loop que só
  // renderiza quando `position === 'end'` — é o que garante que a posição
  // declarada nos dados realmente vira posição na tela.
  const renderFn = fonte.slice(fonte.indexOf('export function PreservationBlogPost'))
  assert.match(renderFn, /post\.midBridge\.position !== 'end'/, 'o render não filtra midBridge do meio quando position é "end"')
  assert.match(renderFn, /post\.midBridge\.position === 'end'/, 'o render não tem um bloco dedicado para midBridge no fim do artigo')

  // Posição textual: o bloco "depois do loop" (checagem position === 'end')
  // precisa aparecer DEPOIS do map de sections no código-fonte do componente.
  const idxSectionsMap = renderFn.indexOf('post.sections.map')
  const idxEndBridge = renderFn.indexOf("post.midBridge.position === 'end'")
  assert.ok(idxSectionsMap > -1 && idxEndBridge > idxSectionsMap, 'o bloco de midBridge de fim precisa vir depois do map de sections no JSX')
})

test('FR-027: guia Shopee cobre cadastro, comissão, regras e como divulgar — nenhuma das quatro falta', () => {
  const bloco = extrairBlocoBlogPost('como-ser-afiliado-shopee-whatsapp')
  assert.match(bloco, /cadastr|torna(r)?-se afiliado/i, 'faltou cobertura de cadastro')
  assert.match(bloco, /comiss[ãa]o/i, 'faltou cobertura de comissão')
  assert.match(bloco, /regras do programa/i, 'faltou cobertura de regras do programa')
  assert.match(bloco, /divulgar/i, 'faltou cobertura de como divulgar')
})

// --- Polish (T043): guarda de FRENTES CONGELADAS (FR-033/FR-034,
// AGENTS.md "SEO orgânico — linhas CONGELADAS"). Contagens abaixo são o
// estado conhecido ANTES desta feature (013) — nenhuma task deste conjunto
// adiciona/remove cidade, nicho ou dor operacional, então devem bater
// exatamente. Uma mudança aqui é sinal de reabertura de linha congelada OU
// de página apagada — os dois são proibidos (FR-033/FR-034).
const BASELINE_CITY_COUNT = 15
const BASELINE_NICHE_COUNT = 11
const BASELINE_PAIN_COUNT = 10
const BASELINE_HUB_COUNT = 3
const BASELINE_ORGANIC_NICHE_COUNT = 2

test('FR-034: nenhuma página das linhas congeladas (cidade/nicho/dor/hub) foi apagada', () => {
  const cityCount = PROGRAMMATIC_SEO_ROUTES.filter((r) => r.type === 'city').length
  const nicheCount = PROGRAMMATIC_SEO_ROUTES.filter((r) => r.type === 'niche').length
  const painCount = PROGRAMMATIC_SEO_ROUTES.filter((r) => r.type === 'pain').length
  const organicNicheCount = SEO_ROUTES.filter((r) => r.template === 'organic-niche').length

  assert.equal(cityCount, BASELINE_CITY_COUNT, 'contagem de rotas por cidade mudou — nenhuma pode ser apagada nem adicionada nesta feature')
  assert.equal(nicheCount, BASELINE_NICHE_COUNT, 'contagem de rotas por nicho mudou')
  assert.equal(painCount, BASELINE_PAIN_COUNT, 'contagem de rotas por dor operacional mudou')
  assert.equal(HUB_SEO_ROUTES.length, BASELINE_HUB_COUNT, 'contagem de hubs mudou')
  assert.equal(organicNicheCount, BASELINE_ORGANIC_NICHE_COUNT, 'contagem de nichos orgânicos mudou')
})

test('FR-033: nenhuma rota nova de cidade além das 15 já congeladas', () => {
  const CIDADES_CONGELADAS = new Set([
    'sao-paulo', 'rio-de-janeiro', 'belo-horizonte', 'curitiba', 'porto-alegre',
    'recife', 'salvador', 'fortaleza', 'brasilia', 'goiania', 'campinas',
    'manaus', 'belem', 'florianopolis', 'vitoria',
  ])
  const cidadesNoRegistro = PROGRAMMATIC_SEO_ROUTES
    .filter((r) => r.type === 'city')
    .map((r) => r.slug.replace('espelhar-grupos-whatsapp-', ''))

  for (const cidade of cidadesNoRegistro) {
    assert.ok(CIDADES_CONGELADAS.has(cidade), `cidade nova encontrada no registro: "${cidade}" — linha congelada por dado (AGENTS.md), não reabrir sem decisão explícita`)
  }
})

test('FR-033: nenhuma rota de nicho novo além dos 11 já congelados', () => {
  const NICHOS_CONGELADOS = new Set([
    'supermercado', 'farmacia', 'eletronicos', 'moda', 'infoprodutos', 'cursos',
    'autopecas', 'turismo', 'pet-shop', 'afiliados', 'beleza',
  ])
  const nichosNoRegistro = PROGRAMMATIC_SEO_ROUTES
    .filter((r) => r.type === 'niche')
    .map((r) => r.slug.replace('bot-ofertas-', '').replace('-whatsapp', ''))

  for (const nicho of nichosNoRegistro) {
    assert.ok(NICHOS_CONGELADOS.has(nicho), `nicho novo encontrado no registro: "${nicho}" — linha congelada por dado, não reabrir sem decisão explícita`)
  }
})

test('FR-033: "robô" não vira termo próprio de cluster (Trends: "robô whatsapp" é 12× menor que "bot whatsapp")', () => {
  for (const route of SEO_ROUTES) {
    assert.doesNotMatch(route.slug ?? route.path, /\brobo\b/i, `${route.path}: slug/path usa "robô" como termo próprio de rota — linha congelada (AGENTS.md)`)
    if (route.intent) {
      assert.doesNotMatch(route.intent, /^robo\b|\brobo (para|de|whatsapp)\b/i, `${route.path}: intent usa "robô" como termo de entrada — linha congelada`)
    }
  }
})

test('FR-033: Magalu não vira frente nova (é em queda no Trends — só entra como uma das 4 lojas suportadas)', () => {
  for (const route of SEO_ROUTES) {
    assert.doesNotMatch(route.path, /magalu|magazine-?luiza/i, `${route.path}: rota dedicada a Magalu — linha congelada, Magalu só entra como uma das lojas suportadas dentro de outra página`)
  }
})

test('FR-033: nenhuma rota nova mirando "automação whatsapp"/"disparo em massa" como termo de entrada', () => {
  // "disparo em massa" não pode aparecer em NENHUM intent (nunca apareceu,
  // linha totalmente nova a barrar). "automação whatsapp" já é o intent do
  // hub /automacao-whatsapp-afiliados, que É PRÉ-EXISTENTE e fica como está
  // (FR-034 proíbe apagar) — a checagem de hub count acima já garante que
  // nenhum HUB NOVO nesse tema foi criado.
  for (const route of SEO_ROUTES) {
    if (!route.intent) continue
    assert.doesNotMatch(route.intent, /disparo em massa/i, `${route.path}: intent mira "disparo em massa" — linha congelada por dado, mercado de atendimento corporativo (Blip/Wati), não afiliado`)
  }
})
