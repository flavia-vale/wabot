import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Bing Webmaster (29/09/2026) acusou "Título muito longo" em /precos: o título
// entregue (com o sufixo de marca do layout) tinha 78 chars e o teto do Bing é
// 70. Guarda para o título da página de preços não voltar a passar disso.
const SUFIXO_TEMPLATE = ' | Espelha Grupos'
const TETO_BING = 70

test('/precos: título entregue cabe no teto de 70 chars do Bing', () => {
  const src = readFileSync(fileURLToPath(new URL('../dashboard/app/precos/page.js', import.meta.url)), 'utf8')
  const meta = src.slice(src.indexOf('export const metadata'))
  const title = meta.match(/^\s{2}title: '([^']+)'/m)?.[1]
  assert.ok(title, 'metadata.title de /precos precisa ser uma string literal')
  const entregue = title + SUFIXO_TEMPLATE
  assert.ok(entregue.length <= TETO_BING, `"${entregue}" tem ${entregue.length} chars (teto ${TETO_BING})`)
})
