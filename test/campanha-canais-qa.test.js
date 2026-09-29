// QA automático das 8 rotas da campanha Canais + Preservação (P0 do backlog
// pós-P3, docs/marketing/canais-antiban/backlog-pos-p3-prioridades.md).
//
// Antes de mandar tráfego para a campanha, quatro coisas precisam valer:
//  1. cada rota existe — ou, se foi renomeada, redireciona para uma que existe;
//  2. todo botão (CTA) aponta para rota que existe, sem passar por redirect, e
//     o de cadastro leva a UTM da campanha; link para página de conteúdo NÃO
//     leva querystring (RCA "página nova nunca nasce órfã") — a UTM de quem
//     chegou fica no cookie de primeiro toque, gravado pelo OrganicPageTracker;
//  3. nenhuma frase promete o que ninguém controla ("100%", "nunca bane",
//     "não bane", "anti-ban garantido") fora de uma negação honesta;
//  4. o mock do painel diz que é ilustração, e não sobra jargão interno
//     ("P1", "P2", "Captura leve") visível na página.
//
// Estático de propósito: roda em `npm test` sem build do Next. O QA de tela
// (mobile 390px) foi feito com o build real — ver o PR de 29/09/2026.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { LEGACY_ROUTE_REDIRECTS } from '../dashboard/next.config.mjs'

const raiz = new URL('..', import.meta.url)
const ler = (rel) => fs.readFileSync(new URL(rel, raiz), 'utf8')
const existe = (rel) => fs.existsSync(new URL(rel, raiz))
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

export const ROTAS_CAMPANHA = [
  '/bot-canais-whatsapp',
  '/diagnostico-antiban-whatsapp',
  '/materiais/checklist-antiban-whatsapp',
  '/ferramentas/calculadora-risco-whatsapp',
  '/bot-comum-vs-botinho',
  '/faq-antiban-whatsapp',
  '/como-funciona-botinho-canais',
  '/protecao-antiban-botinho',
]

// Arquivos que desenham as 8 páginas (as quatro de decisão saem do mesmo módulo).
const ARQUIVOS_CAMPANHA = [
  'dashboard/app/bot-canais-whatsapp/page.js',
  'dashboard/app/diagnostico-antiban-whatsapp/page.js',
  'dashboard/app/materiais/checklist-antiban-whatsapp/page.js',
  'dashboard/app/ferramentas/calculadora-risco-whatsapp/page.js',
  'dashboard/app/_preservationDecisionPages.js',
  'dashboard/components/marketing/PreservationDiagnostic.jsx',
  'dashboard/components/free-tools/WhatsAppRiskCalculator.jsx',
]

const redirectDe = new Map(LEGACY_ROUTE_REDIRECTS.map((r) => [r.source, r.destination]))

function paginaExiste(rota) {
  const limpa = rota.split('?')[0].replace(/\/+$/, '') || '/'
  if (limpa === '/') return existe('dashboard/app/page.js')
  return existe(`dashboard/app${limpa}/page.js`)
}

function rotaFinal(rota) {
  return redirectDe.get(rota) || rota
}

test('P0: as 8 rotas da campanha existem ou redirecionam (permanente) para rota que existe', () => {
  for (const rota of ROTAS_CAMPANHA) {
    const destino = rotaFinal(rota)
    if (destino !== rota) {
      assert.ok(!paginaExiste(rota), `${rota} tem redirect E página própria — o redirect nunca seria usado`)
    }
    assert.ok(paginaExiste(destino), `${rota} → ${destino}: página não existe em dashboard/app`)
  }
})

// Coleta os destinos de link: `href="/x"`, `href: '/x'`, `href={'/x'}`,
// constantes `*Href = '/x'`, `sharedCtas` e os `action="/login"` dos formulários.
function coletarLinks(fonte) {
  const links = new Set()
  const padroes = [
    /href\s*=\s*\{?\s*['"`](\/[^'"`\s]*)['"`]/g,
    /href\s*:\s*['"`](\/[^'"`\s]*)['"`]/g,
    /Href\s*=\s*['"`](\/[^'"`\s]*)['"`]/g,
    /^\s+(?:diagnostic|checklist|calculator|signup|landing)\s*:\s*['"`](\/[^'"`\s]*)['"`]/gm,
    /action\s*=\s*"(\/[^"]*)"/g,
  ]
  for (const re of padroes) for (const m of fonte.matchAll(re)) links.add(m[1])
  return [...links]
}

test('P0: todo CTA das páginas da campanha aponta para rota que existe, sem passar por redirect', () => {
  const vistos = []
  for (const arquivo of ARQUIVOS_CAMPANHA) {
    for (const link of coletarLinks(semComentarios(ler(arquivo)))) {
      const caminho = link.split('?')[0].split('#')[0]
      vistos.push(caminho)
      assert.ok(!redirectDe.has(caminho), `${arquivo}: ${caminho} é rota antiga (redirect) — apontar direto para ${redirectDe.get(caminho)}`)
      assert.ok(paginaExiste(caminho), `${arquivo}: CTA para ${caminho}, que não existe em dashboard/app`)
    }
  }
  // Se o coletor quebrar, o teste passaria vazio. As 4 páginas de decisão
  // (chaves do módulo) também são links (bloco "Leia também").
  assert.ok(vistos.length >= 15, `só ${vistos.length} links coletados — o coletor de href pode ter quebrado`)
  const decisao = ler('dashboard/app/_preservationDecisionPages.js')
  for (const [, chave] of decisao.matchAll(/\n {2}'(\/[^']+)':\s*\{/g)) {
    assert.ok(paginaExiste(chave), `página de decisão ${chave} não existe em dashboard/app`)
  }
})

test('P0: CTA de cadastro leva a UTM da campanha; CTA para conteúdo não leva querystring', () => {
  for (const arquivo of ARQUIVOS_CAMPANHA) {
    const fonte = semComentarios(ler(arquivo))
    for (const link of coletarLinks(fonte)) {
      if (link.startsWith('/login?')) {
        const params = new URLSearchParams(link.split('?')[1].replace(/\$\{campaign\}/g, 'canais-preservacao'))
        assert.equal(params.get('mode'), 'register', `${arquivo}: ${link} sem mode=register`)
        assert.equal(params.get('utm_campaign'), 'canais-preservacao', `${arquivo}: ${link} sem utm_campaign=canais-preservacao`)
        for (const chave of ['utm_source', 'utm_medium', 'utm_content']) {
          assert.ok(params.get(chave), `${arquivo}: ${link} sem ${chave}`)
        }
      } else if (link !== '/login') {
        assert.ok(!link.includes('?'), `${arquivo}: link interno ${link} com querystring — conteúdo usa endereço limpo (a UTM fica no cookie de primeiro toque)`)
      }
    }
    // Cadastro montado por código (diagnóstico/calculadora) ou por formulário.
    if (/URLSearchParams\(\{[\s\S]*mode: 'register'/.test(fonte)) {
      assert.match(fonte, /utm_campaign: 'canais-preservacao'/, `${arquivo}: link de cadastro montado sem utm_campaign da campanha`)
      assert.match(fonte, /utm_content: `/, `${arquivo}: link de cadastro montado sem utm_content`)
    }
    if (/action="\/login"/.test(fonte)) {
      assert.match(fonte, /name="utm_campaign" value="canais-preservacao"/, `${arquivo}: formulário de cadastro sem utm_campaign da campanha`)
      assert.match(fonte, /name="mode" value="register"/, `${arquivo}: formulário de cadastro sem mode=register`)
    }
  }
})

test('P0: cada página de decisão manda o próprio nome no utm_content do cadastro', () => {
  // O módulo tem JSX e alias `@/` — não dá para importar no node:test; a
  // garantia é de forma: o botão usa decisionSignupHref(slug), que troca
  // `utm_content=p2_signup` por `utm_content=p2_signup_<página>`.
  const fonte = ler('dashboard/app/_preservationDecisionPages.js')
  assert.match(fonte, /href=\{decisionSignupHref\(slug\)\}/, 'o botão "Criar conta" das páginas de decisão deve usar decisionSignupHref(slug)')
  assert.match(fonte, /utm_content=p2_signup_\$\{pagina\}/, 'decisionSignupHref precisa pôr a página no utm_content')
  assert.doesNotMatch(fonte, /&page=/, '`page=` não chega ao cadastro (o /login descarta) — a página vai no utm_content')
})

test('P0: a UTM de quem chegou é preservada — toda página da campanha grava o primeiro toque', () => {
  const tracker = ler('dashboard/components/marketing/OrganicPageTracker.jsx')
  assert.match(tracker, /captureFirstTouchLandingPage\(/, 'OrganicPageTracker deixou de gravar a página de entrada (com a UTM do post)')
  for (const arquivo of ARQUIVOS_CAMPANHA.filter((a) => a.startsWith('dashboard/app/'))) {
    assert.match(ler(arquivo), /<OrganicPageTracker route=/, `${arquivo}: sem OrganicPageTracker — visita e clique não são medidos e a UTM de entrada se perde`)
  }
  const login = ler('dashboard/app/login/page.js')
  assert.match(login, /getFirstTouchLandingPage\(\)/, 'o cadastro deixou de enviar a página de entrada')
})

test('P0: todo CTA medido da campanha tem posição, etapa e destino (matriz de eventos)', () => {
  for (const arquivo of ARQUIVOS_CAMPANHA) {
    const fonte = ler(arquivo)
    for (const m of fonte.matchAll(/<Link\b[^>]*data-seo-cta=[^>]*>/gs)) {
      for (const attr of ['data-cta-position', 'data-cta-stage', 'data-cta-destination']) {
        assert.ok(m[0].includes(attr), `${arquivo}: CTA sem ${attr}: ${m[0].slice(0, 120)}`)
      }
    }
  }
})

// Frase com promessa proibida só passa se ela mesma nega ("nenhuma ferramenta
// pode prometer 100%") ou é a pergunta que a resposta seguinte nega.
const PROMESSAS = [
  // `width: '100%'` é CSS; o que conta é 100% colado em promessa.
  /100\s?%\s*(?:contra|segur|garantid|anti|protegid|sem ban|livre)|anti-?ban\s*100|(?:prometer|garant\w*)\s+100\s?%/i,
  /nunca (?:será |vai ser |é )?banid/i,
  /nunca bane/i,
  /n[ãa]o (?:bane|será banid|vai ser banid|toma ban)/i,
  /anti-?ban garantid/i,
  /garant(?:e|ia|imos) (?:de )?(?:que )?(?:n[ãa]o|zero|contra) (?:ser )?ban/i,
  /banimento zero garantido/i,
]
const NEGACAO = /\b(n[ãa]o|nenhum[a]?|nunca prometemos|ningu[ée]m|jamais|sem promessa|sem garantia|promessa absoluta|quem promete|desconfie)\b/i

function frasesVisiveis(fonte) {
  // Texto de string/JSX: aproximação suficiente — quebra em frases por . ! ?
  return semComentarios(fonte)
    .replace(/className="[^"]*"/g, ' ')
    .split(/(?<=[.!?])\s+|\n/)
}

test('P0: nenhuma copy da campanha promete "100%", "nunca bane", "não bane" ou "anti-ban garantido"', () => {
  for (const arquivo of ARQUIVOS_CAMPANHA) {
    const frases = frasesVisiveis(ler(arquivo))
    frases.forEach((frase, i) => {
      for (const padrao of PROMESSAS) {
        if (!padrao.test(frase)) continue
        const pergunta = frase.trim().endsWith('?') || /\?['"`,]/.test(frase)
        const respostaNega = NEGACAO.test(frases.slice(i + 1, i + 3).join(' '))
        assert.ok(
          NEGACAO.test(frase) || (pergunta && respostaNega),
          `${arquivo}: promessa proibida (${padrao}) sem negação: "${frase.trim().slice(0, 160)}"`
        )
      }
    })
  }
})

test('P0: mock do painel na landing está rotulado como ilustração, não como tela real', () => {
  const fonte = semComentarios(ler('dashboard/app/bot-canais-whatsapp/page.js'))
  const inicio = fonte.indexOf('function MiniDashboard')
  assert.ok(inicio !== -1, 'MiniDashboard não encontrado — se o mock mudou de nome, atualizar este teste')
  const mock = fonte.slice(inicio, fonte.indexOf('\nfunction ', inicio + 10))
  assert.match(mock, /aria-label="Ilustra[çc][ãa]o[^"]*n[ãa]o é uma tela real/i, 'o mock precisa dizer (para leitor de tela) que é ilustração, não tela real')
  assert.match(mock, />Ilustra[çc][ãa]o · dados de exemplo</, 'o mock precisa dizer na tela que é ilustração com dados de exemplo')
})

test('P0: sem jargão interno visível nas páginas da campanha', () => {
  for (const arquivo of ARQUIVOS_CAMPANHA) {
    const fonte = semComentarios(ler(arquivo))
    // Texto em JSX (>…<) e em eyebrow/título de string.
    const visivel = [...fonte.matchAll(/>([^<>{}]+)</g), ...fonte.matchAll(/(?:eyebrow|title|label)=["']([^"']+)["']/g)].map((m) => m[1])
    for (const texto of visivel) {
      assert.doesNotMatch(texto, /\bP[0-5]\b/, `${arquivo}: rótulo interno de prioridade visível: "${texto.trim()}"`)
      assert.doesNotMatch(texto, /captura leve|lead magnet|\bMQL\b/i, `${arquivo}: jargão de marketing visível: "${texto.trim()}"`)
    }
  }
})
