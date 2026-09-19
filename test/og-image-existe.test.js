import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// RCA 2026-09-18: o og:image de 7 templates (inclusive as 5 páginas de loja do
// Tier 1) apontava para /api/public/og, rota que nunca existiu — 404 em
// produção, prévia sem imagem no WhatsApp, no ChatGPT e na Perplexity. Esta
// guarda falha se a imagem OG voltar a apontar para algo que não é um arquivo
// real em dashboard/public.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const publicDir = path.join(root, 'dashboard', 'public')

function readPngSize(file) {
  const buf = fs.readFileSync(file)
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${file} não é PNG`)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

test('a imagem OG padrão existe em dashboard/public e tem 1200x630', () => {
  const file = path.join(publicDir, 'og-default.png')
  assert.ok(fs.existsSync(file), 'dashboard/public/og-default.png sumiu — rode `node scripts/build-og-image.mjs`')
  assert.deepEqual(readPngSize(file), { width: 1200, height: 630 })
  const bytes = fs.statSync(file).size
  assert.ok(bytes > 5_000 && bytes < 400_000, `tamanho fora do esperado: ${bytes} bytes`)
})

test('buildOgImageUrl aponta para um arquivo que existe, nunca para uma rota', () => {
  // seo-og.js importa site-url (alias @/ não resolve fora do Next): lemos o
  // caminho exportado direto do fonte, sem executar o módulo.
  const src = fs.readFileSync(path.join(root, 'dashboard', 'lib', 'seo-og.js'), 'utf8')
  const match = src.match(/OG_DEFAULT_IMAGE_PATH = '([^']+)'/)
  assert.ok(match, 'OG_DEFAULT_IMAGE_PATH precisa ser uma string literal em lib/seo-og.js')
  const rel = match[1]
  assert.ok(rel.startsWith('/'), 'caminho absoluto a partir da raiz do site')
  assert.ok(!rel.startsWith('/api/'), 'imagem OG não pode depender de rota de API')
  assert.ok(fs.existsSync(path.join(publicDir, rel)), `${rel} não existe em dashboard/public`)
  assert.doesNotMatch(src, /api\/public\/og\?/, 'a rota inexistente /api/public/og voltou')
})

test('nenhum template do site referencia a rota inexistente /api/public/og', () => {
  const out = execFileSync('grep', ['-rln', 'api/public/og', 'dashboard/app', 'dashboard/lib', 'dashboard/components'], { cwd: root, encoding: 'utf8' }).trim()
  // Só o comentário do RCA em lib/seo-og.js pode citar a rota.
  const files = out ? out.split('\n') : []
  assert.deepEqual(files.filter((f) => f !== 'dashboard/lib/seo-og.js'), [])
})

test('home e layout declaram a imagem de prévia', () => {
  const home = fs.readFileSync(path.join(root, 'dashboard', 'app', 'page.js'), 'utf8')
  const layout = fs.readFileSync(path.join(root, 'dashboard', 'app', 'layout.js'), 'utf8')
  assert.match(home, /images:\s*\[buildOgImageDescriptor\(\)\]/)
  assert.match(layout, /images:\s*\[buildOgImageDescriptor\(\)\]/)
})
