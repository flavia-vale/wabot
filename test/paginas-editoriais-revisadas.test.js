// Revisão das 16 páginas editoriais paradas há mais de 120 dias (24/09/2026).
// Três problemas se repetiam e não podem voltar nestas páginas:
//  1. prometer recurso que o produto não tem ("pausa preventiva", "monitoramento
//     de saúde e cliques", "plano de recuperação" como função da ferramenta);
//  2. texto interno aparecendo para o leitor ("sprint orgânica", "staging",
//     "Lead magnet · Dia 4", "AI SEO", "E-E-A-T", "Checklist SEO/AEO", título
//     "CTA", "Métricas que viram vantagem de SEO");
//  3. produto desatualizado ("lista VIP" com o produto no ar; "não promete
//     integração" quando a conversão do link é o que ele faz).
// E o PDF do checklist sai da MESMA fonte da página (lib/checklist-operacao.js).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const ler = (rel) => fs.readFileSync(new URL(`../dashboard/${rel}`, import.meta.url), 'utf8')
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const ARQUIVOS = [
  'app/conteudos/page.js',
  'app/benchmarks/operacao-grupos-ofertas-whatsapp/page.js',
  'app/blog/como-escalar-grupos-sem-operacao-manual/page.js',
  'app/blog/checklist-padronizar-divulgacao-whatsapp/page.js',
  'app/blog/conferir-converter-link-afiliado-whatsapp/page.js',
  'app/blog/bot-para-afiliados-whatsapp-grupos-cupons/page.js',
  'app/materiais/checklist-operacao-whatsapp/page.js',
  'app/materiais/checklist-divulgacao-ofertas-grupos-whatsapp/page.js',
  'app/glossario/page.js',
  'app/estudos-de-caso/page.js',
  'lib/checklist-operacao.js',
]
const POSTS = ['grupo-ou-canal-whatsapp-achadinhos', 'como-evitar-banimento-whatsapp-afiliados', 'shadowban-whatsapp-canais', 'migrar-grupo-achadinhos-para-canal', 'chip-dedicado-bot-whatsapp', 'bot-whatsapp-antiban-existe']

function blocoPost(chave) {
  const fonte = ler('app/blog/_preservationBlogPosts.js')
  const inicio = fonte.indexOf(`  '${chave}': {`)
  assert.ok(inicio >= 0, chave)
  return fonte.slice(inicio, fonte.indexOf("\n  '", inicio + 5))
}

const PROIBIDO = [
  [/pausas? preventivas?/i, 'o produto só pausa o canal que recusa envios (1 h), não "antes do risco"'],
  [/monitoramento de saúde/i, 'a saúde do canal vem só das falhas de envio; alcance e cliques não são medidos'],
  [/lista vip/i, 'o produto está no ar: o convite é o teste grátis'],
  [/\bstaging\b|sprint|lead magnet|\bAI SEO\b|E-E-A-T|SEO\/AEO|Cluster 1|parseáve/i, 'jargão interno visível'],
  [/>CTA</, 'título "CTA" visível'],
  [/vantagem de SEO/i, 'jargão interno visível'],
  [/n[ãa]o promete integra[çc][ãa]o/i, 'a conversão do link é automática nas 6 lojas'],
]

test('as páginas revisadas não voltam a prometer recurso inexistente nem a mostrar jargão interno', () => {
  const alvos = [
    ...ARQUIVOS.map((rel) => [rel, semComentarios(ler(rel)).replace(/utm_campaign=[^&"'`]+/g, '')]),
    ...POSTS.map((chave) => [chave, blocoPost(chave)]),
  ]
  for (const [nome, texto] of alvos) {
    for (const [padrao, motivo] of PROIBIDO) assert.doesNotMatch(texto, padrao, `${nome}: ${motivo}`)
  }
})

test('o PDF e o .md do checklist saem da mesma fonte da página', async () => {
  const { buildMarkdown, buildPdf } = await import('../dashboard/scripts/build-checklist-operacao.mjs')
  const md = fs.readFileSync(new URL('../dashboard/public/materiais/checklist-operacao-whatsapp.md', import.meta.url), 'utf8')
  assert.equal(md, buildMarkdown(), 'o .md está desatualizado: rode node dashboard/scripts/build-checklist-operacao.mjs')
  const pdf = fs.readFileSync(new URL('../dashboard/public/materiais/checklist-operacao-whatsapp.pdf', import.meta.url))
  assert.ok(pdf.equals(buildPdf()), 'o PDF está desatualizado: rode node dashboard/scripts/build-checklist-operacao.mjs')
  assert.doesNotMatch(pdf.toString('latin1'), /BOTinho|lista VIP/i)
  assert.match(ler('app/materiais/checklist-operacao-whatsapp/page.js'), /CHECKLIST_OPERACAO_BLOCKS/)
})

test('as páginas revisadas dizem o que é do plano Pro', () => {
  for (const chave of ['grupo-ou-canal-whatsapp-achadinhos', 'migrar-grupo-achadinhos-para-canal', 'bot-whatsapp-antiban-existe']) {
    assert.match(blocoPost(chave), /plano Pro/, chave)
  }
})
