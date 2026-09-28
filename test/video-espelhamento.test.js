import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  VIDEO_ESPELHAMENTO,
  VIDEO_ESPELHAMENTO_URL,
  VIDEO_ESPELHAMENTO_EMBED_URL,
} from '../src/tutorialVideo.js'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// Vídeo 1 do plano SEO+GEO (C1): o post que responde a mesma pergunta embute
// o vídeo com VideoObject, e a tela Espelhamento linka para ele. Os três
// lugares leem a MESMA constante — regravou o vídeo, troca-se só o ID.

test('vídeo do espelhamento: URL e embed saem do mesmo ID', () => {
  assert.match(VIDEO_ESPELHAMENTO.id, /^[A-Za-z0-9_-]{11}$/)
  assert.equal(VIDEO_ESPELHAMENTO_URL, `https://www.youtube.com/watch?v=${VIDEO_ESPELHAMENTO.id}`)
  assert.ok(VIDEO_ESPELHAMENTO_EMBED_URL.startsWith(`https://www.youtube-nocookie.com/embed/${VIDEO_ESPELHAMENTO.id}`))
  assert.ok(!Number.isNaN(Date.parse(VIDEO_ESPELHAMENTO.publicadoEm)), 'VideoObject exige uploadDate válido')
})

test('o embed usa o único domínio liberado no frame-src da CSP', () => {
  const nextConfig = read('../dashboard/next.config.mjs')
  assert.match(nextConfig, /frame-src https:\/\/www\.youtube-nocookie\.com/)
})

test('o post "como espelhar mensagens" embute o vídeo com VideoObject', async () => {
  const blog = read('../dashboard/app/blog/_preservationBlogPosts.js')
  const start = blog.indexOf("'como-espelhar-mensagens-entre-grupos-whatsapp': {")
  const end = blog.indexOf('\n  },\n', start)
  const post = blog.slice(start, end)
  assert.ok(start > 0, 'post precisa existir')
  assert.match(post, /video: \{[\s\S]*VIDEO_ESPELHAMENTO_EMBED_URL/)
  assert.match(blog, /'@type': 'VideoObject'/)
  assert.match(blog, /\{post\.video \? <ArticleVideo video=\{post\.video\} \/> : null\}/)
})

test('a tela Espelhamento do painel linka o vídeo pela constante', () => {
  const painel = read('../dashboard/app/painel/espelhamento/page.js')
  assert.match(painel, /import \{ VIDEO_ESPELHAMENTO_URL \} from '\.\.\/\.\.\/\.\.\/\.\.\/src\/tutorialVideo\.js'/)
  assert.match(painel, /href=\{VIDEO_ESPELHAMENTO_URL\}/)
  assert.doesNotMatch(painel, /nch0Lo3Zz1U/, 'ID colado na mão vira cópia esquecida quando o vídeo for regravado')
})
