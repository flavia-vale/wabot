import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/* Guarda de regressão da prova social (auditoria de funil 2026-08-05, §1.1).
 *
 * A home publicava "1.200+ afiliadas", "R$ 4,2M em comissões", "380k links" e
 * "4,9 ★" mais três depoimentos com nome e avatar, sem lastro em lugar nenhum —
 * e o bloco é renderizado também em todas as LPs (via app/_lpShared.js), não só
 * na home. Além do risco de publicidade enganosa (CDC art. 37 / CONAR), isso
 * contradizia PRODUCT_LIMITATIONS ("Não prometemos ganho financeiro"), impressa
 * na MESMA página.
 *
 * Este teste falha se qualquer número desses voltar, ou se voltar promessa de
 * ganho financeiro no bloco. Não é teste de layout: é trava de compliance.
 * Para publicar número novo: tenha fonte rastreável, cite a fonte na própria
 * página e só então relaxe a asserção correspondente — conscientemente.
 */

const SOCIAL_FILES = [
  'dashboard/components/landing/Social.jsx',
  'landing/src/components/Social.jsx',
]

// Números exatos que estavam publicados sem lastro.
const FABRICATED_CLAIMS = ['1.200', '1200 afiliadas', 'R$ 4,2M', '4,2M', '380k', '4,9 ★', '4,9★']

// Frases de promessa de retorno financeiro que estavam nos depoimentos.
const FINANCIAL_PROMISES = [
  'comissão pingando',
  'paguei a assinatura do ano',
  'dinheiro que eu deixava na mesa',
  'comissões geradas',
]

/* Comentários são removidos antes da checagem: a regra vale para o que é
 * RENDERIZADO. Os comentários desses arquivos citam os números antigos de
 * propósito, para o próximo leitor saber o que não pode voltar — se a checagem
 * os pegasse, a documentação da regra derrubaria a própria regra. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function readSocial(relPath) {
  return stripComments(readFileSync(join(repoRoot, relPath), 'utf8'))
}

test('bloco de prova social não publica número de cliente/comissão sem lastro', () => {
  for (const relPath of SOCIAL_FILES) {
    const src = readSocial(relPath)
    for (const claim of FABRICATED_CLAIMS) {
      assert.ok(
        !src.includes(claim),
        `${relPath} voltou a publicar "${claim}". Número no site exige fonte rastreável — ver AUDITORIA_FUNIL_LEADS_CONVERSAO_2026-08-05.md §1.1.`,
      )
    }
  }
})

test('bloco de prova social não promete retorno financeiro', () => {
  for (const relPath of SOCIAL_FILES) {
    const src = readSocial(relPath)
    for (const promise of FINANCIAL_PROMISES) {
      assert.ok(
        !src.includes(promise),
        `${relPath} voltou a prometer ganho financeiro ("${promise}"), contradizendo PRODUCT_LIMITATIONS.`,
      )
    }
  }
})

test('home usa o vídeo oficial como prova verificável', () => {
  const src = readSocial('dashboard/components/landing/Social.jsx')
  assert.ok(
    src.includes('BRAND_YOUTUBE_TUTORIAL_EMBED_URL'),
    'o bloco de prova social deve embutir o tutorial oficial — é a prova que o visitante consegue conferir sozinho',
  )

  const content = readFileSync(join(repoRoot, 'dashboard/lib/marketing-content.js'), 'utf8')
  assert.ok(
    content.includes('youtube-nocookie.com/embed/'),
    'o embed deve usar youtube-nocookie para não plantar cookie de rastreio antes de o vídeo tocar',
  )
})
