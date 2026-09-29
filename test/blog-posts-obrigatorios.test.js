import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(repoRoot, 'dashboard/app/blog/_preservationBlogPosts.js'), 'utf8')

/* Todo post do blog precisa de (1) imagem de capa, (2) assinatura de autora e
 * (3) links vindos de OUTROS posts — senão vira página órfã (só o /conteudos e o
 * sitemap apontam). Regra da dona do produto, 29/09/2026.
 *
 * AGUARDANDO_IMAGEM é uma lista que só ENCOLHE: quando a imagem chega, tire o
 * slug daqui e coloque o `heroImage` no post. Prompts em
 * docs/marketing/PROMPTS_IMAGENS_BLOG_2026-09-29.md. */
const AGUARDANDO_IMAGEM = new Set([
  'amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp',
])
const MIN_LINKS_DE_ENTRADA = 2

function parsePosts() {
  const marks = [...src.matchAll(/^  '([a-z0-9-]+)': \{/gm)]
  return marks.map((m, i) => {
    const body = src.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : src.length)
    const related = body.includes('relatedLinks: [') ? body.split('relatedLinks: [')[1].split('\n    ],')[0] : ''
    return {
      slug: m[1],
      hasHero: /heroImage:/.test(body),
      hasAuthor: /usePersonAuthor: true/.test(body),
      links: [...related.matchAll(/href: '(\/blog\/[a-z0-9-]+)'/g)].map((x) => x[1]),
    }
  })
}

const posts = parsePosts()

test('o parser enxerga os posts', () => {
  assert.ok(posts.length >= 24)
})

test('todo post tem imagem de capa (ou está na lista que só encolhe)', () => {
  for (const p of posts) {
    if (AGUARDANDO_IMAGEM.has(p.slug)) continue
    assert.ok(p.hasHero, `${p.slug} sem heroImage`)
  }
  for (const slug of AGUARDANDO_IMAGEM) {
    const p = posts.find((x) => x.slug === slug)
    assert.ok(p, `${slug} não existe mais: tire da lista`)
    assert.ok(!p.hasHero, `${slug} já tem imagem: tire da lista AGUARDANDO_IMAGEM`)
  }
})

test('todo post tem a assinatura da autora', () => {
  for (const p of posts) assert.ok(p.hasAuthor, `${p.slug} sem usePersonAuthor`)
})

test('nenhum post é órfão: ao menos 2 outros posts apontam para ele', () => {
  for (const p of posts) {
    const entrada = posts.filter((o) => o.slug !== p.slug && o.links.includes(`/blog/${p.slug}`)).length
    assert.ok(entrada >= MIN_LINKS_DE_ENTRADA, `${p.slug} recebe só ${entrada} link(s) de outros posts`)
  }
})
