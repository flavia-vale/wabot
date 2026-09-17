// Guarda dos limites que reprovam revisão (FR-029..FR-034) — specs/013-inbound-leads-strategy.
// Varre o texto PUBLICADO, não a intenção: entrar pela palavra "banido"/
// "anti-ban" continua permitido (é como as pessoas buscam), só a PROMESSA de
// não-banimento reprova. Este arquivo nasce em US4 (T030, só FR-029 contra
// /bot-afiliados-whatsapp) e é ESTENDIDO — nunca recriado — em US5 (T036:
// preço/fonte/data + bestFit), US6 (T041: promessa + posição do CTA de
// produto), no guard de frentes congeladas no Polish final (T043), e em T047
// (FR-041), que troca os alvos fixos por VARREDURA de todas as entradas dos
// módulos de conteúdo — um comparativo/página nova sem `bestFit`, sem preço
// sourceado ou com promessa de não-banimento reprova o CI automaticamente,
// sem precisar editar este arquivo.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SEO_ROUTES, HUB_SEO_ROUTES, PROGRAMMATIC_SEO_ROUTES } from '../dashboard/lib/seo-registry.mjs'
import { getCompetitorBySlug } from '../dashboard/lib/competitors-data.js'

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

// (T047) A varredura por TODAS as páginas encontrou casos legítimos de
// NEGAÇÃO da garantia bem perto de um padrão acima — ex.: "/anti-ban-whatsapp"
// diz "Ninguém pode garantir que você não será banido." (contém literalmente
// "não será banido") e "Nenhuma ferramenta garante imunidade" (contém
// literalmente "garante imunidade"). As duas são o USO HONESTO que este
// arquivo sempre permitiu (ver comentário acima) — só que agora precisam de
// checagem de contexto, não só de substring, porque uma página inteira nova
// entrou na varredura. Se a MESMA sentença que carrega o padrão proibido tem,
// pouco antes, uma palavra de negação da garantia ("ninguém", "nenhum(a)",
// "não há/existe/podemos/dá para/pode"), o trecho é permitido — é negação,
// não promessa.
const NEGACAO_ANTES_RE = /\b(ningu[ée]m|nenhuma|nenhum|n[ãa]o\s+(h[áa]|existe|podemos|d[áa]\s+para|pode))\b[^.!?]{0,80}$/i
const JANELA_CONTEXTO_ANTES = 80

// (T051) Segundo contexto legítimo, diferente da negação-antes: a PERGUNTA de
// um par de FAQ. "A calculadora garante que meu WhatsApp não será banido?"
// contém literalmente o padrão proibido, mas é a pergunta que a página existe
// para responder — e a negação vive na RESPOSTA ao lado, não antes do trecho
// na mesma sentença, então NEGACAO_ANTES_RE não a alcança. Estender a
// varredura sem isto quebraria o CI com dois falsos positivos.
//
// Uma pergunta não é promessa; mas exigimos as duas condições juntas para não
// abrir brecha: a sentença que carrega o trecho termina em "?" E a resposta
// logo em seguida nega a garantia. Pergunta retórica seguida de promessa
// continua reprovando.
// A negação precisa ser A RESPOSTA, não uma palavra solta perto dela. Segunda
// brecha encontrada na revisão, depois da primeira já corrigida: procurar
// negação em 400 chars deixava passar "Nosso robô garante imunidade? Sim! E
// não cobramos taxa." — o "não" de "não cobramos" desculpava a promessa. Por
// isso a janela é o INÍCIO da resposta, e uma afirmação logo aí reprova na
// hora, mesmo que venha negação depois.
const INICIO_RESPOSTA = 80
// Folga para a casca estrutural do código entre a pergunta e a resposta.
const CASCA_ESTRUTURAL = 40
const AFIRMACAO_RE = /^\W*(sim|com certeza|claro|garantimos|garantido|sempre)\b/i
const NEGACAO_NA_RESPOSTA_RE = /^\W*(n[ãa]o\b|ningu[ée]m\b|nenhum[a]?\b|depende\b|imposs[íi]vel\b|desconfie\b)/i

function ehPerguntaRespondidaComNegacao(texto, _indice, fim) {
  // O terminador da PRÓPRIA sentença precisa ser "?". Procurar o próximo "?"
  // em qualquer lugar do texto abriria brecha larga: página de FAQ tem
  // pergunta o tempo todo mais adiante, então quase toda promessa seria
  // desculpada como "é pergunta". Verificado injetando promessas sintéticas —
  // três passavam com a versão que buscava "?" solto.
  const terminador = texto.slice(fim).match(/[.!?]/)
  if (!terminador || terminador[0] !== '?') return false
  const depoisDaPergunta = fim + terminador.index + 1
  // Entre a pergunta e a resposta pode haver a estrutura do próprio código —
  // `', \n answer: '` quando o par vive em dois campos (caso das FAQs reais)
  // — ou nada, quando pergunta e resposta estão no mesmo texto corrido. Os
  // dois precisam funcionar: recortar sem tirar essa casca fazia a resposta
  // honesta "Não. Nenhuma ferramenta séria garante banimento zero" ser lida
  // como promessa.
  const inicioDaResposta = texto
    .slice(depoisDaPergunta, depoisDaPergunta + INICIO_RESPOSTA + CASCA_ESTRUTURAL)
    .replace(/^['",\s]*(answer|resposta|a)\s*:\s*['"]?/i, '')
    .slice(0, INICIO_RESPOSTA)
  if (AFIRMACAO_RE.test(inicioDaResposta)) return false
  return NEGACAO_NA_RESPOSTA_RE.test(inicioDaResposta)
}

function encontrarPromessaProibida(texto) {
  for (const padrao of PADROES_PROMESSA_NAO_BANIMENTO) {
    const re = new RegExp(padrao.source, padrao.flags.includes('g') ? padrao.flags : `${padrao.flags}g`)
    let m
    while ((m = re.exec(texto))) {
      const antes = texto.slice(Math.max(0, m.index - JANELA_CONTEXTO_ANTES), m.index)
      if (!NEGACAO_ANTES_RE.test(antes) && !ehPerguntaRespondidaComNegacao(texto, m.index, re.lastIndex)) {
        return { trecho: m[0], padrao }
      }
      if (m.index === re.lastIndex) re.lastIndex++ // evita loop infinito em match vazio
    }
  }
  return null
}

function extrairBlocoPorChave(fonte, chave) {
  const marcador = `'${chave}': {`
  const idx = fonte.indexOf(marcador)
  if (idx === -1) throw new Error(`chave "${chave}" não encontrada`)
  const resto = fonte.slice(idx + marcador.length)
  const fimRelativo = resto.search(/\n {2}'/)
  return fimRelativo === -1 ? resto : resto.slice(0, fimRelativo)
}

function listarChaves(fonte) {
  return [...fonte.matchAll(/\n {2}'([^']+)':\s*\{/g)].map((m) => m[1])
}

function extrairBlocoPreservationCommercial(pageKey) {
  return extrairBlocoPorChave(lerFonte('dashboard/app/_preservationCommercialPages.js'), pageKey)
}

// (T047, FR-029) Varre TODAS as entradas de _preservationCommercialPages.js
// (5 páginas, inclusive /anti-ban-whatsapp — a mais exposta à promessa, que
// não estava coberta antes) e de _preservationBlogPosts.js (15 posts) — não
// só a página nomeada em FR-024/US4. Uma página nova em qualquer um dos dois
// módulos entra na varredura automaticamente pelo `listarChaves()`, sem
// editar este arquivo.
// (T051) Faltavam as DUAS páginas mais expostas à promessa — `/faq-antiban-whatsapp`
// e `/protecao-antiban-botinho`, ambas em `_preservationDecisionPages.js`, cujo
// assunto INTEIRO é banimento — e as três páginas de risco que esta rodada
// reescreveu (diagnóstico, checklist, calculadora), que têm `page.js` próprio e
// por isso não aparecem em módulo de conteúdo nenhum.
const PAGINAS_DE_RISCO_COM_PAGE_JS = [
  'dashboard/app/diagnostico-antiban-whatsapp/page.js',
  'dashboard/app/materiais/checklist-antiban-whatsapp/page.js',
  'dashboard/app/ferramentas/calculadora-risco-whatsapp/page.js',
]

function paginasParaChecarFR029() {
  const preservationFonte = lerFonte('dashboard/app/_preservationCommercialPages.js')
  const blogFonte = lerFonte('dashboard/app/blog/_preservationBlogPosts.js')
  const decisionFonte = lerFonte('dashboard/app/_preservationDecisionPages.js')
  return [
    ...listarChaves(preservationFonte).map((chave) => ({
      origem: '_preservationCommercialPages.js',
      chave,
      bloco: extrairBlocoPorChave(preservationFonte, chave),
    })),
    ...listarChaves(blogFonte).map((chave) => ({
      origem: '_preservationBlogPosts.js',
      chave,
      bloco: extrairBlocoPorChave(blogFonte, chave),
    })),
    ...listarChaves(decisionFonte).map((chave) => ({
      origem: '_preservationDecisionPages.js',
      chave,
      bloco: extrairBlocoPorChave(decisionFonte, chave),
    })),
    ...PAGINAS_DE_RISCO_COM_PAGE_JS.map((arquivo) => ({
      origem: arquivo,
      chave: arquivo.split('/').slice(-2)[0],
      bloco: lerFonte(arquivo),
    })),
  ]
}

test('FR-029: nenhuma página comercial/blog promete que a conta não será banida (varredura completa)', () => {
  const paginas = paginasParaChecarFR029()
  assert.ok(paginas.length >= 27, `varredura de FR-029 achou só ${paginas.length} páginas — o parser de listarChaves() pode ter quebrado`)

  for (const { origem, chave, bloco } of paginas) {
    const achado = encontrarPromessaProibida(bloco)
    assert.equal(
      achado,
      null,
      achado
        ? `${origem}#${chave}: promessa de não-banimento ("${achado.trecho}", padrão: ${achado.padrao}) — reescrever como negação honesta, nunca garantia`
        : undefined
    )
  }
})

test('FR-029: as páginas dedicadas ao tema (bot-afiliados-whatsapp, anti-ban-whatsapp) continuam abordando o risco honestamente, não evitando o assunto', () => {
  for (const pageKey of ['bot-afiliados-whatsapp', 'anti-ban-whatsapp']) {
    const bloco = extrairBlocoPreservationCommercial(pageKey)
    assert.match(bloco, /banid[oa]|anti-?ban|banimento/i, `${pageKey}: a página deveria abordar o tema de risco honestamente, não evitá-lo`)
  }
})

// --- US5 (T036): extensão para /alternativas/achadinho-pro. T047 (FR-041)
// troca essa página fixa por varredura de TODAS as entradas de
// _comparisonContent.js que declaram `competitorSlugs` (comparativo de
// verdade, contra um ou mais concorrentes nomeados) — páginas sem
// `competitorSlugs` (ex.: /melhores-bots-para-afiliados-whatsapp, um guia de
// critérios sem concorrente único) ficam fora do escopo de FR-030/031/032 por
// não serem "alternativa a X" nenhum X específico, mas continuam cobertas por
// FR-029 acima (nenhuma delas está nos dois módulos de FR-029, então nem
// precisam — o critério de escopo aqui é estrutural: ter `competitorSlugs`).

function extrairBlocoComparativo(path) {
  return extrairBlocoPorChave(lerFonte('dashboard/app/_comparisonContent.js'), path)
}

function extrairCompetitorSlugsDoBloco(bloco) {
  const m = bloco.match(/competitorSlugs:\s*\[([^\]]*)\]/)
  if (!m) return []
  return [...m[1].matchAll(/'([^']+)'/g)].map((mm) => mm[1])
}

// Regex de preço em formato brasileiro (R$ N ou R$ N.NNN,NN) — mais estrito
// que "R$ seguido de qualquer dígito/ponto/vírgula" para não engolir
// pontuação de frase logo depois do preço (ex.: "R$ 37, mais barato" não pode
// virar o preço "R$ 37,"). Usado nos dois lados (página e competitors-data.js)
// para os dois conjuntos ficarem na mesma unidade de comparação.
const PRECO_RE = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g

function normalizarPreco(bruto) {
  // Remove espaço interno ("R$ 39" vira "R$39" — as duas formas convivem no
  // mesmo módulo hoje) e o ",00" de reais fechados ("R$300,00" vira "R$300",
  // igual à forma como o texto da página cita o mesmo valor sem centavos).
  return bruto.replace(/\s+/g, '').replace(/,00$/, '')
}

function precosDoTexto(texto) {
  return [...texto.matchAll(PRECO_RE)].map((m) => normalizarPreco(m[0]))
}

function paraNumero(precoNormalizado) {
  const semSimbolo = precoNormalizado.replace('R$', '').replace(/\./g, '').replace(',', '.')
  const n = Number(semSimbolo)
  return Number.isFinite(n) ? n : null
}

function formatarPreco(n) {
  return Number.isInteger(n) ? `R$${n}` : `R$${n.toFixed(2).replace('.', ',')}`
}

// Preços do próprio BOTinho (planos Basic/Pro) citados lado a lado com o
// concorrente em todo comparativo — não são "preço de concorrente" (FR-031
// exige fonte para preço DO CONCORRENTE), então entram como allowlist fixa,
// não vinda de competitors-data.js (que é só para concorrente).
const PRECOS_PROPRIOS_BOTINHO = ['R$39', 'R$69']

function precosPermitidosParaPagina(competitorSlugs) {
  const permitidos = new Set(PRECOS_PROPRIOS_BOTINHO)
  for (const slug of competitorSlugs) {
    const competitor = getCompetitorBySlug(slug)
    assert.ok(competitor, `competitorSlug "${slug}" referenciado em _comparisonContent.js não existe em competitors-data.js`)
    assert.ok(competitor.verifiedAt, `competitors-data.js: "${slug}" sem verifiedAt`)
    assert.ok(competitor.source, `competitors-data.js: "${slug}" sem source`)
    for (const tier of competitor.pricingTiers ?? []) {
      for (const preco of precosDoTexto(tier.price)) permitidos.add(preco)
    }
  }
  // Deltas entre dois valores já sourceados (ex.: R$59,97 - R$49,97 = R$10)
  // não são número novo — são aritmética sobre dado que já passou pela fonte
  // única, o mesmo raciocínio que já valia hardcoded para achadinho-pro,
  // generalizado aqui para qualquer par de preços já permitidos.
  const numeros = [...permitidos].map(paraNumero).filter((n) => n != null)
  for (const a of numeros) {
    for (const b of numeros) {
      const delta = a - b
      if (delta > 0) permitidos.add(normalizarPreco(formatarPreco(delta)))
    }
  }
  return permitidos
}

function comparisonPagesComConcorrente() {
  const fonte = lerFonte('dashboard/app/_comparisonContent.js')
  return listarChaves(fonte)
    .filter((chave) => chave.startsWith('/'))
    .map((path) => ({ path, bloco: extrairBlocoPorChave(fonte, path) }))
    .filter(({ bloco }) => extrairCompetitorSlugsDoBloco(bloco).length > 0)
}

test('FR-030/031/032 (T047): varredura roda sobre pelo menos os 8 comparativos com concorrente nomeado conhecidos nesta rodada', () => {
  const paginas = comparisonPagesComConcorrente()
  assert.ok(paginas.length >= 8, `esperava >= 8 páginas com competitorSlugs em _comparisonContent.js, achei ${paginas.length} — checklist-comparativos.md prevê mais 5`)
})

test('FR-030: todo comparativo com concorrente nomeado se apresenta como alternativa/comparação, nunca se passa pelo concorrente', () => {
  // Formato aceito: "Alternativa(s) a/ao/de X" (formato /alternativas/*) OU
  // "X ou Y: quando/qual ..." (formato "vs" contra prática genérica). Os dois
  // são leitura honesta de comparação; título que não bate com nenhum dos
  // dois é sinal de posicionamento arriscado (a página se apresentando como
  // se FOSSE a alternativa, sem deixar claro que é comparação).
  // `à` entrou em 2026-09-17 com o comparativo da Lumi: "Alternativa à Lumi" é
  // a mesma moldura e a forma gramaticalmente correta em português quando a
  // marca pede o artigo. Não afrouxa nada — o que a guarda impede é o título se
  // apresentar como se FOSSE o concorrente, e isso continua barrado.
  //
  // ⚠️ O corte usa `(\s|$)`, NUNCA `\b`: `à` não é caractere de palavra em
  // ASCII, então `\b` depois dele não casa nunca e o título correto era
  // reprovado em silêncio. Mesma família do RCA da classe de emoji sem a flag
  // `u`.
  const FRAMES_COMPARATIVOS = [/^alternativas?\s+(a|à|ao|de)(\s|$)/i, /\bou\b.*\b(quando|qual)\b/i]

  for (const { path, bloco } of comparisonPagesComConcorrente()) {
    const title = bloco.match(/title:\s*'([^']+)'/)?.[1]
    assert.ok(title, `${path}: não achei o title`)

    assert.ok(
      FRAMES_COMPARATIVOS.some((re) => re.test(title)),
      `${path}: título "${title}" não se apresenta como comparação (nem "alternativa(s) a/ao/de X" nem "X ou Y: quando/qual...")`
    )

    for (const slug of extrairCompetitorSlugsDoBloco(bloco)) {
      const competitor = getCompetitorBySlug(slug)
      if (!competitor?.name) continue
      assert.doesNotMatch(
        title.trim(),
        new RegExp(`^${competitor.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
        `${path}: o título não pode se apresentar como o próprio "${competitor.name}"`
      )
    }
  }
})

test('FR-031: todo preço citado em comparativo com concorrente tem correspondência em competitors-data.js (verifiedAt+source) ou é preço próprio/delta', () => {
  for (const { path, bloco } of comparisonPagesComConcorrente()) {
    const slugs = extrairCompetitorSlugsDoBloco(bloco)
    const permitidos = precosPermitidosParaPagina(slugs)
    const precosNaPagina = precosDoTexto(bloco)

    for (const preco of precosNaPagina) {
      assert.ok(
        permitidos.has(preco),
        `${path}: preço "${preco}" não bate com nenhum valor verificado em competitors-data.js (slugs: ${slugs.join(', ')}) nem é delta/preço próprio do BOTinho`
      )
    }
  }
})

test('FR-032: todo comparativo com concorrente nomeado tem bestFit dizendo quando o concorrente é a melhor escolha', () => {
  // "sobre o concorrente" = item do bestFit cujo sujeito NÃO é o próprio
  // BOTinho ("Escolha BOTinho..."/"BOTinho é/são..."). Todo comparativo
  // precisa de pelo menos um item assim — um bestFit onde toda entrada só
  // fala do BOTinho não responde "quando o concorrente é a melhor escolha"
  // (FR-032), mesmo tendo o campo preenchido.
  const SUJEITO_BOTINHO_RE = /^(escolha\s+(o\s+|a\s+)?botinho\b|botinho\s+(é|s[ãa]o)\b)/i

  for (const { path, bloco } of comparisonPagesComConcorrente()) {
    assert.match(bloco, /bestFit:\s*\[/, `${path}: faltou o campo bestFit`)

    const idxInicio = bloco.indexOf('bestFit:')
    const idxFim = bloco.indexOf('],', idxInicio)
    const bestFitBloco = idxFim === -1 ? bloco.slice(idxInicio) : bloco.slice(idxInicio, idxFim)
    const itens = [...bestFitBloco.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])

    assert.ok(itens.length >= 2, `${path}: bestFit precisa de pelo menos 2 itens (BOTinho + concorrente) para poder dizer quando cada um vence`)
    assert.ok(
      itens.some((item) => !SUJEITO_BOTINHO_RE.test(item.trim())),
      `${path}: nenhum item do bestFit fala do concorrente — todos abrem com o BOTinho como sujeito`
    )
  }
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

// LINHA REABERTA EM 2026-09-02, por decisão explícita da dona do produto.
//
// O congelamento original vinha do Trends: Magalu é o único marketplace da
// nossa lista em queda, então "não invista uma frente nova aí". Isso era um
// argumento de PRIORIZAÇÃO, não de correção — e a prioridade é decisão dela.
//
// A guarda não foi apagada, e é de propósito. Ela deixou de proibir Magalu por
// completo e passou a proibir a REABERTURA da linha antiga: uma página
// comercial por loja é o padrão da frente Tier 1 (mesma forma de Shopee,
// Mercado Livre, Amazon e SHEIN), mas cidade, nicho e dor seguem congelados, e
// nenhuma outra rota de Magalu pode nascer sem passar por aqui de novo.
const ROTAS_MAGALU_APROVADAS = new Set(['/magalu-afiliados-whatsapp'])

test('FR-033: Magalu só existe na rota comercial aprovada em 02/09 — nenhuma outra', () => {
  for (const route of SEO_ROUTES) {
    if (!/magalu|magazine-?luiza/i.test(route.path)) continue
    assert.ok(
      ROTAS_MAGALU_APROVADAS.has(route.path),
      `${route.path}: rota nova de Magalu. A linha foi reaberta em 02/09 SÓ para a página comercial ` +
        `/magalu-afiliados-whatsapp, no mesmo padrão das outras lojas. Magalu é o único marketplace ` +
        `em queda no Trends — qualquer rota além dessa precisa de decisão nova, não de um append aqui.`
    )
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
