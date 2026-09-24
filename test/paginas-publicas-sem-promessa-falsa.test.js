// Páginas públicas fora das 16 revisadas em 24/09/2026 (bot-canais, decisão,
// landings, hubs, componentes de marketing). Três coisas não voltam:
//  1. prometer o que o produto não faz: "pausa preventiva" (a única pausa
//     automática é a do canal que recusa envios 3 vezes — 1 h, plano Pro,
//     src/core/channelHealth.js), cliques medidos (clickTracker não está
//     ligado no envio), "plano de recuperação" como função da ferramenta;
//  2. convite "Lista VIP" com o produto no ar (o convite é o teste grátis);
//  3. jargão interno visível ("staging", "Sprint 1").
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const ler = (rel) => fs.readFileSync(new URL(`../dashboard/${rel}`, import.meta.url), 'utf8')
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const ARQUIVOS = [
  'app/bot-canais-whatsapp/page.js',
  'app/_preservationDecisionPages.js',
  'app/_preservationCommercialPages.js',
  'app/_lpShared.js',
  'app/_seoHubShared.js',
  'app/_organicNicheLanding.js',
  'app/blog/_preservationBlogPosts.js',
  'app/diagnostico-antiban-whatsapp/page.js',
  'app/seguranca-credenciais-afiliado/page.js',
  'components/landing/FAQ.jsx',
  'components/marketing/LeadMagnetCard.jsx',
  'lib/proof-assets.js',
  'public/llms.txt',
  'public/pricing.md',
]

const PROIBIDO = [
  [/pausas? preventivas?/i, 'a única pausa automática é a do canal que recusa envios (1 h)'],
  [/monitoramento de saúde/i, 'a saúde do canal vem só das falhas de envio'],
  [/Sinais, cliques, erros/i, 'cliques não são medidos pelo produto'],
  [/lista vip/i, 'o produto está no ar: o convite é o teste grátis'],
  [/\bstaging\b|\bSprint \d/i, 'jargão interno visível'],
  [/monitoramento e plano de recupera[çc][ãa]o/i, 'plano de recuperação é da cliente, não função da ferramenta'],
]

test('páginas públicas não prometem recurso inexistente nem mostram jargão interno', () => {
  for (const arquivo of ARQUIVOS) {
    const texto = arquivo.startsWith('public/') ? ler(arquivo) : semComentarios(ler(arquivo))
    for (const [padrao, motivo] of PROIBIDO) {
      assert.doesNotMatch(texto, padrao, `${arquivo}: ${motivo}`)
    }
  }
})

test('a pausa automática aparece como ela é: canal que recusa envios, 1 hora, plano Pro', () => {
  const canais = semComentarios(ler('app/bot-canais-whatsapp/page.js'))
  assert.match(canais, /pausado sozinho por 1 hora/)
  assert.match(canais, /plano Pro/)
  const blog = semComentarios(ler('app/blog/_preservationBlogPosts.js'))
  assert.match(blog, /recusa envios 3 vezes seguidas/)
  assert.doesNotMatch(blog, /não pausa sozinha/, 'o canal que recusa envios é pausado sozinho')
})
