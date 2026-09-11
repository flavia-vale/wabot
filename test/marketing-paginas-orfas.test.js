// Guarda de "página nova NUNCA nasce órfã" (RCA 2026-09-11, AGENTS.md).
//
// As cinco páginas comerciais do Tier 1 passaram 9 dias com zero impressão. A
// Inspeção de URL do Search Console deu o veredito: "Detectada, mas não
// indexada", com "Último rastreamento: N/D" e "Página de referência: Nenhuma
// página foi detectada". O Google nunca leu essas páginas. Não era conteúdo
// duplicado nem noindex — era DESCOBERTA: o único link interno para elas saía
// de /conteudos, a página mais fraca do site.
//
// Estar no sitemap não é descoberta. O sitemap diz que a página existe; o link
// interno diz que ela importa. Por isso a contagem aqui IGNORA o sitemap, o
// registry e /conteudos: os três são índice, não recomendação.
//
// Regra: toda rota indexável precisa de pelo menos MINIMO_LINKS links internos
// vindos de outras páginas. `DIVIDA_HISTORICA` é a lista de rotas que já
// nasceram abaixo disso antes da regra existir — ela só pode DIMINUIR. Rota
// nova entrando ali reprova; o certo é linkar a página, não registrar a dívida.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getIndexableSeoRoutes } from '../dashboard/lib/seo-registry.mjs'

const MINIMO_LINKS = 3
const raiz = new URL('..', import.meta.url).pathname

// Só pode encolher. Ao linkar uma destas de três lugares, remova-a daqui.
const DIVIDA_HISTORICA = new Set([
  '/escalar-grupos-ofertas-sem-equipe',
  '/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo',
  '/aumentar-conversao-em-grupos-de-cupons',
  '/consistencia-postagens-em-grupos',
  '/reduzir-tempo-operacional-em-grupos-whatsapp',
  '/rastrear-resultados-de-divulgacao-em-grupos',
  '/bot-ofertas-restaurantes-whatsapp',
  '/bot-ofertas-marketplace-whatsapp',
  '/bot-ofertas-afiliados-whatsapp',
  '/organizar-calendario-de-ofertas-no-whatsapp',
  '/melhorar-alcance-em-grupos-de-promocoes',
  '/cadastro',
  '/grupo-para-canal-whatsapp',
  '/blog/como-escalar-grupos-sem-operacao-manual',
  '/blog/checklist-padronizar-divulgacao-whatsapp',
  '/blog/comecar-afiliado-whatsapp-sem-grupo-grande',
  '/blog/quanto-custa-bot-para-whatsapp-afiliados',
  '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp',
  '/como-funciona-botinho-canais',
  '/botinho-vs-ferramentas-genericas-automacao',
  '/glossario',
  '/alternativas/bot-para-whatsapp-afiliados',
  '/alternativas/promium',
  '/alternativas/gigi-bot',
  '/quem-somos',
  '/automatizar-divulgacao-em-grupos-whatsapp',
  '/padronizar-divulgacao-afiliado-whatsapp',
  '/parcerias',
  '/bot-canal-whatsapp',
  '/comparativos',
  '/parceiro-influenciador',
  '/benchmarks/operacao-grupos-ofertas-whatsapp',
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons',
  '/blog/shadowban-whatsapp-canais',
  '/blog/migrar-grupo-achadinhos-para-canal',
  '/botinho-vs-planilha-manual',
  '/estudos-de-caso',
  '/alternativas/proafiliados',
  '/alternativas/shozap',
  '/alternativas/fluxopromo',
  '/alternativas/achadinho-pro',
  '/clonar-mensagens-de-grupo-de-afiliados',
  '/confiabilidade-sessao-whatsapp',
  '/seguranca-credenciais-afiliado',
])

const arquivosDeFonte = () => {
  const out = []
  const walk = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entrada.name)
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules' || entrada.name === '.next') continue
        walk(p)
      } else if (/\.(js|jsx|mjs)$/.test(entrada.name)) {
        out.push(p)
      }
    }
  }
  for (const dir of ['dashboard/app', 'dashboard/lib', 'dashboard/components']) {
    walk(path.join(raiz, dir))
  }
  return out
}

const ehIndice = (arquivo) =>
  arquivo.includes('seo-registry') || arquivo.includes('sitemap') || arquivo.includes('/conteudos/')

const contarLinksInternos = (rota, arquivos) => {
  const propriaPasta = path.join(raiz, 'dashboard/app' + rota) + path.sep
  let total = 0
  for (const arquivo of arquivos) {
    if (arquivo.startsWith(propriaPasta) || ehIndice(arquivo)) continue
    for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
      // a declaração da própria página no gerador não é link de entrada
      if (/^\s*(path|slug):\s*['"]/.test(linha)) continue
      if (/^\s*['"]?\/?[\w/-]+['"]?:\s*\{\s*$/.test(linha)) continue
      if (linha.includes("'" + rota + "'") || linha.includes('"' + rota + '"')) total += 1
    }
  }
  return total
}

const rotasIndexaveis = () =>
  getIndexableSeoRoutes()
    .map((r) => r.path)
    .filter((r) => r !== '/' && !r.endsWith('.txt') && !r.endsWith('.md'))

test('toda rota indexável nova tem pelo menos 3 links internos', () => {
  const arquivos = arquivosDeFonte()
  const orfas = []
  for (const rota of rotasIndexaveis()) {
    if (DIVIDA_HISTORICA.has(rota)) continue
    const links = contarLinksInternos(rota, arquivos)
    if (links < MINIMO_LINKS) orfas.push(`${rota} (${links} link(s))`)
  }
  assert.deepEqual(
    orfas,
    [],
    'Página com menos de 3 links internos acaba em "Detectada, mas não indexada" — o Google nem chega a ler. ' +
      'Linke cada uma a partir de 3 páginas já indexadas que tratem do mesmo assunto (sitemap e /conteudos não contam), ' +
      'e peça reindexação TAMBÉM das páginas editadas. Rotas sem link suficiente:\n  ' +
      orfas.join('\n  '),
  )
})

test('a dívida histórica de páginas órfãs só pode diminuir', () => {
  const arquivos = arquivosDeFonte()
  const jaResolvidas = []
  for (const rota of DIVIDA_HISTORICA) {
    if (contarLinksInternos(rota, arquivos) >= MINIMO_LINKS) jaResolvidas.push(rota)
  }
  assert.deepEqual(
    jaResolvidas,
    [],
    'Estas rotas já têm links suficientes e devem sair de DIVIDA_HISTORICA:\n  ' + jaResolvidas.join('\n  '),
  )
})

test('DIVIDA_HISTORICA não guarda rota que saiu do registry', () => {
  const vivas = new Set(rotasIndexaveis())
  const fantasmas = [...DIVIDA_HISTORICA].filter((r) => !vivas.has(r))
  assert.deepEqual(fantasmas, [], 'Rotas removidas do site ainda listadas como dívida:\n  ' + fantasmas.join('\n  '))
})

// RCA 2026-09-11, 2ª parte: 119 links internos em 16 páginas apontavam para
// `/rota?utm_source=seo&utm_medium=internal&…`. O endereço que o Google
// descobre precisa ser o canônico — a variante com parâmetro gasta
// rastreamento e joga a consolidação toda na canônica.
//
// `/login` e `/cadastro` seguem carregando os parâmetros: ali o UTM é a
// atribuição do cadastro, não um link de conteúdo. E o clique interno continua
// medido por `data-seo-cta` (o evento já grava cta, posição, estágio, destino e
// href — o utm_content era redundante).

const HREF_INTERNO_COM_UTM = /href[=:]\s*[{'"`]*(\/(?!login|cadastro)[A-Za-z0-9/_-]+)\?[^'"`\s}]*utm_/g

test('link interno para página de conteúdo não carrega UTM', () => {
  const ofensores = []
  for (const arquivo of arquivosDeFonte()) {
    const texto = fs.readFileSync(arquivo, 'utf8')
    for (const achado of texto.matchAll(HREF_INTERNO_COM_UTM)) {
      ofensores.push(`${path.relative(raiz, arquivo)} -> ${achado[1]}`)
    }
  }
  assert.deepEqual(
    ofensores,
    [],
    'Link interno com querystring faz o Google descobrir a variante em vez do endereço canônico. ' +
      'Aponte para o endereço limpo; o clique já é medido por data-seo-cta. ' +
      'Atribuição de cadastro continua em /login e /cadastro:\n  ' +
      ofensores.join('\n  '),
  )
})
