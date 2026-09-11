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
// interno diz que ela importa. Por isso a contagem aqui IGNORA /conteudos: é
// índice, não recomendação.
//
// ⚠️ A contagem é feita no HTML CONSTRUÍDO, nunca na fonte. A primeira versão
// desta guarda leu os arquivos-fonte e errou feio: as páginas de "dor" montam
// os links umas das outras por `getRelatedProgrammaticSeoRoutes`, em tempo de
// render, então apareciam como órfãs com ZERO links quando na verdade tinham
// ONZE. Link montado em laço não existe no texto do arquivo. O HTML construído
// é o que o Google de fato lê — é essa a única medição que vale.
//
// Sem `.next` construído o arquivo PULA (mesma convenção de
// test/admin-capacity-page.test.js). A CI constrói, então lá ele roda.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getIndexableSeoRoutes } from '../dashboard/lib/seo-registry.mjs'

const MINIMO_LINKS = 3
const raiz = new URL('..', import.meta.url).pathname
const BUILD = path.join(raiz, 'dashboard/.next/server/app')

// Só pode encolher. Ao linkar uma destas de três lugares, remova-a daqui.
// A dívida foi QUITADA em 2026-09-11: todas as 86 rotas indexáveis passaram a
// ter três ou mais links internos de entrada. A lista fica aqui, vazia, porque
// só pode ser usada para uma coisa — registrar uma dívida que já existe — e
// nunca para acomodar página nova. Rota nova entrando aqui reprova a revisão:
// o certo é linkar a página, não registrar a dívida.
const DIVIDA_HISTORICA = new Set([])

const rotasIndexaveis = () =>
  getIndexableSeoRoutes()
    .map((r) => r.path)
    .filter((r) => r !== '/' && !r.endsWith('.txt') && !r.endsWith('.md'))

function paginasConstruidas() {
  if (!fs.existsSync(BUILD)) return null
  const arquivos = []
  const walk = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entrada.name)
      if (entrada.isDirectory()) walk(p)
      else if (entrada.name.endsWith('.html')) arquivos.push(p)
    }
  }
  walk(BUILD)
  return arquivos.length ? arquivos : null
}

function contarLinksDeEntrada(arquivos) {
  const rotas = rotasIndexaveis()
  const rotaDoArquivo = (f) => '/' + path.relative(BUILD, f).replace(/\.html$/, '')
  const entrada = new Map(rotas.map((r) => [r, 0]))
  for (const arquivo of arquivos) {
    const origem = rotaDoArquivo(arquivo)
    if (origem === '/conteudos') continue // índice, não recomendação
    const texto = fs.readFileSync(arquivo, 'utf8')
    for (const rota of rotas) {
      if (rota === origem) continue
      if (texto.includes(`href="${rota}"`)) entrada.set(rota, entrada.get(rota) + 1)
    }
  }
  return entrada
}

const arquivos = paginasConstruidas()
const semBuild = !arquivos
const pular = { skip: semBuild ? 'dashboard/.next ausente — rode `npm run build --prefix dashboard`' : false }
const entrada = semBuild ? new Map() : contarLinksDeEntrada(arquivos)

test('toda rota indexável nova tem pelo menos 3 links internos de entrada', pular, () => {
  const orfas = []
  for (const rota of rotasIndexaveis()) {
    if (DIVIDA_HISTORICA.has(rota)) continue
    const links = entrada.get(rota) ?? 0
    if (links < MINIMO_LINKS) orfas.push(`${rota} (${links} link(s) de entrada)`)
  }
  assert.deepEqual(
    orfas,
    [],
    'Página com menos de 3 links internos acaba em "Detectada, mas não indexada" — o Google nem chega a ler. ' +
      'Linke cada uma a partir de 3 páginas já indexadas que tratem do mesmo assunto (/conteudos e o sitemap não contam), ' +
      'e peça reindexação TAMBÉM das páginas editadas. Rotas sem link suficiente:\n  ' +
      orfas.join('\n  '),
  )
})

test('a dívida histórica de páginas órfãs só pode diminuir', pular, () => {
  const jaResolvidas = [...DIVIDA_HISTORICA].filter((rota) => (entrada.get(rota) ?? 0) >= MINIMO_LINKS)
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

function arquivosDeFonte() {
  const out = []
  const walk = (dir) => {
    for (const entradaDir of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entradaDir.name)
      if (entradaDir.isDirectory()) {
        if (entradaDir.name === 'node_modules' || entradaDir.name === '.next') continue
        walk(p)
      } else if (/\.(js|jsx|mjs)$/.test(entradaDir.name)) {
        out.push(p)
      }
    }
  }
  for (const dir of ['dashboard/app', 'dashboard/lib', 'dashboard/components']) walk(path.join(raiz, dir))
  return out
}

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
