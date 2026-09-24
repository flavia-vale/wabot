// Complemento de test/nome-antigo-fora-do-texto-publico.test.js (que cobre as
// páginas públicas). Decisão da dona do produto (23/09/2026): "Espelha Grupos
// em todos os lugares" — inclusive admin e painel, que aquela guarda pula.
// E o LinkedIn da empresa usa o endereço com o nome da marca.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const raiz = new URL('..', import.meta.url).pathname

function arquivos(dir) {
  const out = []
  for (const e of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...arquivos(rel))
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(rel)
  }
  return out
}

// Comentário explica a história do nome e não chega à tela.
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

test('admin e painel não escrevem o nome antigo em texto de tela', () => {
  const achados = []
  for (const rel of [...arquivos('dashboard/app/admin'), ...arquivos('dashboard/app/painel')]) {
    semComentarios(fs.readFileSync(path.join(raiz, rel), 'utf8')).split('\n')
      .forEach((linha, i) => { if (/BOTinho/.test(linha)) achados.push(`${rel}:${i + 1}`) })
  }
  assert.deepEqual(achados, [])
})

test('LinkedIn da empresa: endereço com o nome da marca, no sameAs e em link visível', async () => {
  const { BRAND_SAME_AS, BRAND_LINKEDIN_URL } = await import('../dashboard/lib/marketing-content.js')
  assert.equal(BRAND_LINKEDIN_URL, 'https://www.linkedin.com/company/espelha-grupos/')
  assert.ok(BRAND_SAME_AS.includes(BRAND_LINKEDIN_URL))
  for (const rel of ['dashboard/components/landing/Social.jsx', 'dashboard/app/quem-somos/page.js']) {
    assert.match(fs.readFileSync(path.join(raiz, rel), 'utf8'), /href=\{BRAND_LINKEDIN_URL\}/, rel)
  }
  assert.match(fs.readFileSync(path.join(raiz, 'dashboard/public/llms.txt'), 'utf8'), /linkedin\.com\/company\/espelha-grupos\//)
})
