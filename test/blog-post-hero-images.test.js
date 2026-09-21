import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// RCA 2026-09-21: os posts do blog eram só texto — nenhum tinha imagem, nem
// no corpo, nem no og:image do post, nem no JSON-LD do Article. Cada post
// ganhou uma `heroImage`, reaproveitada do pacote de imagens da dona do
// produto (mesmo mascote/design system das redes sociais). Esta guarda
// existe para que declarar `heroImage` num post não vire promessa vazia: o
// arquivo precisa existir de verdade em `dashboard/public`, bater com as
// dimensões declaradas, e o texto/JSON-LD/og:image precisam de fato usar o
// campo — sem isso seria fácil declarar a imagem e ela nunca aparecer em
// lugar nenhum.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const publicDir = path.join(root, 'dashboard', 'public')
const postsSrc = fs.readFileSync(path.join(root, 'dashboard', 'app', 'blog', '_preservationBlogPosts.js'), 'utf8')

function extractHeroImages(src) {
  const out = []
  const re = /heroImage:\s*\{\s*path:\s*'([^']+)',\s*alt:\s*'([^']+)',\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/g
  let match
  while ((match = re.exec(src))) {
    out.push({ path: match[1], alt: match[2], width: Number(match[3]), height: Number(match[4]) })
  }
  return out
}

function readImageDimensions(file) {
  const buf = fs.readFileSync(file)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length) {
      if (buf[i] !== 0xff) break
      const marker = buf[i + 1]
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      }
      const len = buf.readUInt16BE(i + 2)
      i += 2 + len
    }
  }
  throw new Error(`formato de imagem não reconhecido (nem PNG nem JPEG): ${file}`)
}

test('todo post do blog com heroImage aponta para um arquivo real em dashboard/public, com as dimensões declaradas', () => {
  const heroImages = extractHeroImages(postsSrc)
  assert.ok(heroImages.length >= 15, `esperava pelo menos 15 posts com heroImage, achou ${heroImages.length}`)
  for (const hero of heroImages) {
    assert.ok(hero.path.startsWith('/blog/hero/'), `${hero.path} devia morar em /blog/hero/`)
    const file = path.join(publicDir, hero.path)
    assert.ok(fs.existsSync(file), `${hero.path} não existe em dashboard/public`)
    const dims = readImageDimensions(file)
    assert.deepEqual(dims, { width: hero.width, height: hero.height }, `dimensões declaradas de ${hero.path} não batem com o arquivo real`)
    assert.ok(hero.alt.length > 15, `alt text muito curto (ou vazio) para ${hero.path}`)
    assert.doesNotMatch(hero.alt, /\.(png|jpg|jpeg)$/i, `alt de ${hero.path} parece nome de arquivo, não descrição`)
  }
})

test('nenhuma imagem de destaque é reaproveitada em mais de um post', () => {
  const paths = extractHeroImages(postsSrc).map((hero) => hero.path)
  assert.equal(paths.length, new Set(paths).size, 'duas ou mais entradas de heroImage apontam para o mesmo arquivo')
})

test('PreservationBlogPost passa a heroImage do post para o ArticleShell e para o JSON-LD do Article', () => {
  assert.match(postsSrc, /heroImage=\{post\.heroImage\}/)
  assert.match(postsSrc, /image:\s*post\.heroImage/)
})

test('getPreservationBlogMetadata usa a heroImage do post no og:image, com fallback pro og-default quando o post não tem uma', () => {
  assert.match(postsSrc, /buildOgImageDescriptor\(\{\s*imagePath:\s*post\.heroImage\.path/)
  assert.match(postsSrc, /:\s*buildOgImageDescriptor\(\)/)
  assert.match(postsSrc, /images:\s*\[ogImage\]/)
})

test('ArticleShell renderiza a heroImage (com alt) ANTES do corpo do post, nunca depois', () => {
  const shellSrc = fs.readFileSync(path.join(root, 'dashboard', 'components', 'marketing', 'ArticleShell.jsx'), 'utf8')
  assert.match(shellSrc, /heroImage\.path/)
  assert.match(shellSrc, /heroImage\.alt/)
  const heroImgIdx = shellSrc.indexOf('heroImage.path')
  const childrenIdx = shellSrc.indexOf('{children}')
  assert.ok(heroImgIdx > -1 && childrenIdx > -1 && heroImgIdx < childrenIdx, 'a imagem de destaque precisa vir ANTES do corpo do post ({children})')
})

test('buildOgImageUrl/buildOgImageDescriptor aceitam override sem mudar o comportamento histórico dos chamadores antigos', () => {
  const ogSrc = fs.readFileSync(path.join(root, 'dashboard', 'lib', 'seo-og.js'), 'utf8')
  assert.match(ogSrc, /options\.imagePath \?\? OG_DEFAULT_IMAGE_PATH/)
  assert.match(ogSrc, /if \(!options\.imagePath\)/)
})

test('buildArticleJsonLd só emite `image` quando o post fornece uma (não inventa imagem pra post sem heroImage)', () => {
  const editorialSrc = fs.readFileSync(path.join(root, 'dashboard', 'lib', 'editorial-content.js'), 'utf8')
  assert.match(editorialSrc, /\.\.\.\(image\?\.path \? \{ image: `\$\{siteUrl\}\$\{image\.path\}` \} : \{\}\)/)
})
