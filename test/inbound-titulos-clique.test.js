// Guarda de P1 (specs/013-inbound-leads-strategy): as 10 páginas de FR-004
// precisam trazer o motivo pra clicar dentro da janela que o Google mostra no
// celular, sem duplicar título/descrição com outra página do site, e sem
// manter título/descrição em dois lugares ao mesmo tempo (FR-001 — foi
// exatamente essa divergência silenciosa que deixou o registry com o título
// antigo de /bot-achadinhos-whatsapp enquanto o ar já servia o novo).
//
// Este teste deve FALHAR antes das tasks de implementação (T004-T010):
// nada foi reescrito ainda, e vários dos 10 caminhos ainda têm title/
// description tanto no seo-registry.mjs quanto no módulo de conteúdo.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SEO_ROUTES } from '../dashboard/lib/seo-registry.mjs'

const raiz = new URL('..', import.meta.url)
const lerFonte = (caminho) => fs.readFileSync(new URL(caminho, raiz), 'utf8')

// O sufixo vem de dashboard/app/layout.js (title.template: '%s | Espelha
// Grupos'). Fica FORA do orçamento de 55 (decisão D1 de plan.md / R2 de
// research.md) — é anexado no fim, é a primeira coisa que o Google corta no
// celular, e é medido/reportado na falha, não somado ao orçamento.
const SUFIXO_TEMPLATE = ' | Espelha Grupos'
const ORCAMENTO_TITULO = 55
const ORCAMENTO_DESCRICAO = 160
const tituloEntregue = (bruto) => bruto + SUFIXO_TEMPLATE

// Arquivos onde o título de página é escrito à mão. O sufixo de marca NUNCA
// entra aqui: quem o coloca é o `title.template` do layout.
const MODULOS_COM_TITULO = [
  'dashboard/app/_lpShared.js',
  'dashboard/app/_organicNicheLanding.js',
  'dashboard/app/_comparisonContent.js',
  'dashboard/app/_seoHubShared.js',
  'dashboard/app/_preservationCommercialPages.js',
  'dashboard/app/blog/_preservationBlogPosts.js',
]

test('nenhum título carrega sufixo de marca próprio — o layout já anexa o dele', () => {
  // Achado de 2026-08-19: 38 títulos terminavam em ' | BOTinho' e o template
  // anexava ' | Espelha Grupos' por cima, entregando DUAS marcas em sequência
  // — uma delas aposentada na unificação de 2026-08-04 (marketing-content.js:
  // 'Espelha Grupos' é a MARCA e vai no title template; 'BOTinho' é o NOME DO
  // PRODUTO e vive no corpo do texto). Uma das páginas afetadas é a terceira
  // que mais converte no site (173 impressões, 8,09% de clique).
  const sufixosProibidos = [/ \| BOTinho'/, / \| Espelha Grupos'/]

  for (const arquivo of MODULOS_COM_TITULO) {
    const fonte = lerFonte(arquivo)
    for (const [i, titulo] of [...fonte.matchAll(/title: '([^']+)'/g)].entries()) {
      for (const proibido of sufixosProibidos) {
        assert.doesNotMatch(
          `title: '${titulo[1]}'`,
          proibido,
          `${arquivo} (title #${i + 1}): "${titulo[1]}" já traz sufixo de marca. O layout anexa "${SUFIXO_TEMPLATE}" por cima, entregando duas marcas em sequência.`
        )
      }
    }
  }
})

// Extrai o bloco de um objeto literal `'chave': { ... }` sem cruzar para o
// próximo item de nível superior (que sempre começa em nova linha com 2
// espaços de indentação + aspas simples nestes arquivos).
function blocoChave(caminhoArquivo, chave) {
  const fonte = lerFonte(caminhoArquivo)
  const marcador = `'${chave}': {`
  const idx = fonte.indexOf(marcador)
  if (idx === -1) throw new Error(`chave "${chave}" não encontrada em ${caminhoArquivo}`)
  const resto = fonte.slice(idx + marcador.length)
  const fimRelativo = resto.search(/\n {2}'/)
  const bloco = fimRelativo === -1 ? resto : resto.slice(0, fimRelativo)
  return {
    title: bloco.match(/title:\s*'([^']+)'/)?.[1] ?? null,
    description: bloco.match(/description:\s*'([^']+)'/)?.[1] ?? null,
  }
}

// Páginas com metadata literal (`const title = '...'`), não objeto de registro.
function blocoConst(caminhoArquivo) {
  const fonte = lerFonte(caminhoArquivo)
  return {
    title: fonte.match(/const title = '([^']+)'/)?.[1] ?? null,
    description: fonte.match(/const description = '([^']+)'/)?.[1] ?? null,
  }
}

// Os 10 caminhos nomeados em FR-004, com a fonte real de onde a página lê
// title/description hoje (depois de T004-T010, é sempre o módulo de
// conteúdo — nunca mais o seo-registry.mjs).
const ALVOS = [
  { path: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', fonte: () => blocoChave('dashboard/app/blog/_preservationBlogPosts.js', 'melhores-horarios-para-postar-ofertas-no-whatsapp') },
  { path: '/programa-de-afiliados', fonte: () => blocoConst('dashboard/app/programa-de-afiliados/page.js') },
  { path: '/alternativas/fluxopromo', fonte: () => blocoChave('dashboard/app/_comparisonContent.js', '/alternativas/fluxopromo') },
  { path: '/bot-ofertas-afiliados-whatsapp', fonte: () => blocoChave('dashboard/app/_lpShared.js', 'bot-ofertas-afiliados-whatsapp') },
  { path: '/blog/conferir-converter-link-afiliado-whatsapp', fonte: () => blocoConst('dashboard/app/blog/conferir-converter-link-afiliado-whatsapp/page.js') },
  { path: '/bot-ofertas-whatsapp', fonte: () => blocoChave('dashboard/app/_seoHubShared.js', 'bot-ofertas-whatsapp') },
  { path: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', fonte: () => blocoChave('dashboard/app/blog/_preservationBlogPosts.js', 'como-montar-grupo-de-ofertas-no-whatsapp-do-zero') },
  { path: '/alternativas/achadinhos-bot', fonte: () => blocoChave('dashboard/app/_comparisonContent.js', '/alternativas/achadinhos-bot') },
  { path: '/blog/como-divulgar-ofertas-amazon-whatsapp', fonte: () => blocoChave('dashboard/app/blog/_preservationBlogPosts.js', 'como-divulgar-ofertas-amazon-whatsapp') },
  { path: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp', fonte: () => blocoChave('dashboard/app/blog/_preservationBlogPosts.js', 'como-divulgar-ofertas-mercado-livre-whatsapp') },
]

// (T052) As três páginas de risco reescritas em T049. Não estão em FR-004 —
// entraram porque o título que entra pela palavra buscada ("banido", "ban",
// "banimento") estava parado no seo-registry.mjs e nunca tinha ido ao ar,
// enquanto o page.js publicava o termo próprio da casa ("Preservação
// Avançada"), que o AGENTS.md proíbe como porta de entrada. Ficam sob o mesmo
// teto de 55 para não repetir o problema que P1 veio consertar.
const ALVOS_RISCO_REESCRITOS = [
  { path: '/diagnostico-antiban-whatsapp', fonte: () => blocoConst('dashboard/app/diagnostico-antiban-whatsapp/page.js') },
  { path: '/materiais/checklist-antiban-whatsapp', fonte: () => blocoConst('dashboard/app/materiais/checklist-antiban-whatsapp/page.js') },
  { path: '/ferramentas/calculadora-risco-whatsapp', fonte: () => blocoConst('dashboard/app/ferramentas/calculadora-risco-whatsapp/page.js') },
]

test('os 3 títulos de risco reescritos cabem em 55 chars e entram pela palavra buscada, não pelo termo da casa', () => {
  for (const alvo of ALVOS_RISCO_REESCRITOS) {
    const { title, description } = alvo.fonte()
    assert.ok(title, `${alvo.path}: não achei o title na fonte`)
    assert.ok(
      title.length <= ORCAMENTO_TITULO,
      `${alvo.path}: título com ${title.length} chars (entregue: "${tituloEntregue(title)}" = ${tituloEntregue(title).length} chars) passa de ${ORCAMENTO_TITULO}`
    )
    assert.match(
      title,
      /ban(id[oa]|imento)?\b/i,
      `${alvo.path}: o título precisa entrar pela palavra que a pessoa busca ("banido"/"ban"/"banimento") — o termo próprio da casa é explicado DENTRO da página, nunca usado como porta de entrada (AGENTS.md)`
    )
    assert.doesNotMatch(
      title,
      /preserva[çc][ãa]o avan[çc]ada/i,
      `${alvo.path}: "Preservação Avançada" é o termo da casa e não pode ser a porta de entrada`
    )
    assert.ok(description && description.length <= ORCAMENTO_DESCRICAO, `${alvo.path}: description ausente ou acima de ${ORCAMENTO_DESCRICAO} chars`)
  }
})

test('os 10 títulos de FR-004 cabem em 55 chars de texto próprio (sufixo medido à parte)', () => {
  for (const alvo of ALVOS) {
    const { title } = alvo.fonte()
    assert.ok(title, `${alvo.path}: não achei o title na fonte`)
    assert.ok(
      title.length <= ORCAMENTO_TITULO,
      `${alvo.path}: título com ${title.length} chars (entregue: "${tituloEntregue(title)}" = ${tituloEntregue(title).length} chars) passa de ${ORCAMENTO_TITULO}`
    )
  }
})

test('as descrições das páginas de FR-004 cabem em 160 chars', () => {
  for (const alvo of ALVOS) {
    const { description } = alvo.fonte()
    assert.ok(description, `${alvo.path}: não achei a description na fonte`)
    assert.ok(
      description.length <= ORCAMENTO_DESCRICAO,
      `${alvo.path}: description com ${description.length} chars passa de ${ORCAMENTO_DESCRICAO}`
    )
  }
})

test('alternativas/fluxopromo e alternativas/achadinhos-bot dizem "alternativa a/ao", nunca se apresentam como o concorrente (FR-030)', () => {
  for (const path of ['/alternativas/fluxopromo', '/alternativas/achadinhos-bot']) {
    const alvo = ALVOS.find((a) => a.path === path)
    const { title } = alvo.fonte()
    assert.match(title, /^alternativa (a|ao)/i, `${path}: título "${title}" não começa com "Alternativa a/ao"`)
  }
})

test('nenhum dos 10 títulos/descrições novos duplica outra página do site', () => {
  const titulos = new Map()
  const descricoes = new Map()

  for (const alvo of ALVOS) {
    const { title, description } = alvo.fonte()
    assert.ok(!titulos.has(title), `título duplicado: "${title}" em ${alvo.path} e ${titulos.get(title)}`)
    titulos.set(title, alvo.path)
    assert.ok(!descricoes.has(description), `description duplicada: "${description}" em ${alvo.path} e ${descricoes.get(description)}`)
    descricoes.set(description, alvo.path)
  }

  // Cruza contra os títulos literais que sobraram no registry (rotas fora do
  // escopo desta feature) — pega colisão acidental com página não tocada.
  for (const route of SEO_ROUTES) {
    if (!route.title) continue
    if (ALVOS.some((a) => a.path === route.path)) continue
    assert.ok(!titulos.has(route.title), `título "${route.title}" duplicado entre ${route.path} (registry) e ${titulos.get(route.title)}`)
  }
})

test('fonte única (FR-001): os 10 caminhos de FR-004 não têm title/description ao mesmo tempo no registry e no módulo de conteúdo', () => {
  for (const alvo of ALVOS) {
    const route = SEO_ROUTES.find((r) => r.path === alvo.path)
    const { title: moduleTitle, description: moduleDescription } = alvo.fonte()

    if (moduleTitle) {
      assert.equal(
        route?.title,
        undefined,
        `${alvo.path}: title existe no seo-registry.mjs E no módulo de conteúdo — fonte única quebrada (FR-001)`
      )
    }
    if (moduleDescription) {
      assert.equal(
        route?.description,
        undefined,
        `${alvo.path}: description existe no seo-registry.mjs E no módulo de conteúdo — fonte única quebrada (FR-001)`
      )
    }
  }
})

// --- Frente Tier 1 ---------------------------------------------------------
//
// `shopee afiliados`, `mercado livre afiliados` e `afiliado amazon` têm 50.000
// buscas/mês cada e concorrência BAIXA (AGENTS.md, "Dados de mercado para
// marketing") — é a maior oportunidade aberta do levantamento. A página da
// Shopee já existe e já entra pelo termo; o que faltava era caber na tela do
// celular, que traz 62% das impressões com metade do CTR do computador.
//
// Estas páginas ficam sob o MESMO teto de 55 das de FR-004: não adianta abrir
// a frente de maior volume do site e entregar um título cortado.
const ALVOS_TIER_1 = [
  {
    path: '/blog/como-ser-afiliado-shopee-whatsapp',
    termo: /shopee afiliados/i,
    fonte: () => blocoChave('dashboard/app/blog/_preservationBlogPosts.js', 'como-ser-afiliado-shopee-whatsapp'),
  },
]

test('as páginas da frente Tier 1 cabem em 55 chars e entram pelo termo de maior volume', () => {
  for (const alvo of ALVOS_TIER_1) {
    const { title, description } = alvo.fonte()
    assert.ok(title, `${alvo.path}: não achei o title na fonte`)
    assert.ok(
      title.length <= ORCAMENTO_TITULO,
      `${alvo.path}: título com ${title.length} chars (entregue: "${tituloEntregue(title)}" = ${tituloEntregue(title).length} chars) passa de ${ORCAMENTO_TITULO} — é a frente de maior volume do site, não pode chegar cortada no celular`
    )
    assert.match(
      title,
      alvo.termo,
      `${alvo.path}: o título precisa carregar o termo de 50.000 buscas/mês — é ele que abre a frente`
    )
    assert.ok(
      description && description.length <= ORCAMENTO_DESCRICAO,
      `${alvo.path}: description ausente ou acima de ${ORCAMENTO_DESCRICAO} chars`
    )
  }
})
