import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// A autoria por pessoa física dos posts (usePersonAuthor: true) existe para
// E-E-A-T / citação por IA (ver comentário em editorial-content.js). Uma
// autoria que só mostra o nome, sem foto real nem link verificável para fora
// do site, é mais fraca — o Google e as IAs preferem entidade checável.
// Desde 20/09/2026 a assinatura carrega foto (dashboard/public/authors) e
// link para o LinkedIn PESSOAL, e o schema Article usa o MESMO `@id` do
// Person que o layout raiz declara como `founder` — sem isso, o post e a
// fundadora do site viram duas entidades soltas para quem lê o JSON-LD.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const publicDir = path.join(root, 'dashboard', 'public')

test('a foto da autora existe em dashboard/public/authors e é um JPEG de verdade', () => {
  const file = path.join(publicDir, 'authors', 'flavia-vale.jpg')
  assert.ok(fs.existsSync(file), 'dashboard/public/authors/flavia-vale.jpg sumiu')
  const buf = fs.readFileSync(file)
  assert.equal(buf[0], 0xff, 'não começa com o marcador JPEG (FFD8)')
  assert.equal(buf[1], 0xd8, 'não começa com o marcador JPEG (FFD8)')
  const bytes = buf.length
  assert.ok(bytes > 2_000 && bytes < 200_000, `tamanho fora do esperado: ${bytes} bytes`)
})

test('editorial-content.js exporta foto, LinkedIn e @id da autora, derivados do founder único', () => {
  const src = fs.readFileSync(path.join(root, 'dashboard', 'lib', 'editorial-content.js'), 'utf8')
  assert.match(src, /EDITORIAL_PERSON_AUTHOR_PHOTO_PATH = '\/authors\/flavia-vale\.jpg'/)
  assert.match(src, /EDITORIAL_PERSON_AUTHOR_LINKEDIN_URL = FOUNDER_LINKEDIN_URL/)
  assert.match(src, /EDITORIAL_PERSON_AUTHOR_ID_PATH = FOUNDER_PERSON_ID_PATH/)
})

test('buildArticleJsonLd inclui @id, url, image e sameAs quando o autor traz esses campos', () => {
  const src = fs.readFileSync(path.join(root, 'dashboard', 'lib', 'editorial-content.js'), 'utf8')
  assert.match(src, /author\.idPath.*@id/s)
  assert.match(src, /author\.photoPath.*image/s)
  assert.match(src, /author\.sameAs.*sameAs/s)
})

test('ArticleShell renderiza foto e link do autor quando fornecidos', () => {
  const src = fs.readFileSync(path.join(root, 'dashboard', 'components', 'marketing', 'ArticleShell.jsx'), 'utf8')
  assert.match(src, /authorPhotoPath/)
  assert.match(src, /authorHref/)
  assert.match(src, /target="_blank"/)
})

test('os posts com usePersonAuthor no blog passam foto e LinkedIn para o ArticleShell', () => {
  const src = fs.readFileSync(path.join(root, 'dashboard', 'app', 'blog', '_preservationBlogPosts.js'), 'utf8')
  assert.match(src, /authorPhotoPath=\{post\.usePersonAuthor \? EDITORIAL_PERSON_AUTHOR_PHOTO_PATH/)
  assert.match(src, /authorHref=\{post\.usePersonAuthor \? EDITORIAL_PERSON_AUTHOR_LINKEDIN_URL/)
})
