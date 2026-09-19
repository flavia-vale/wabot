import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getIndexableSeoRoutes } from '../dashboard/lib/seo-registry.mjs'
import { DEFAULT_LANDING_PLANS, SUPPORTED_STORES } from '../dashboard/lib/marketing-content.js'

// RCA 2026-09-18: o llms.txt (o arquivo que as IAs leem primeiro) não citava
// preço nem as 6 lojas e omitia as páginas comerciais que mais convertem —
// enquanto a Perplexity preenchia o nosso preço com o de concorrente. Guarda:
// preço e lojas iguais às constantes do produto, páginas de venda presentes e
// nenhuma URL apontando para rota que não existe no registro SEO.

const here = path.dirname(fileURLToPath(import.meta.url))
const llms = fs.readFileSync(path.join(here, '..', 'dashboard', 'public', 'llms.txt'), 'utf8')
const SITE = 'https://espelhagrupos.com.br'

// Rotas servidas fora do registro SEO (arquivos estáticos e páginas legais).
const STATIC_OK = new Set(['/', '/pricing.md', '/llms.txt', '/suporte', '/termos', '/privacidade', '/quem-somos', '/conteudos'])

test('preços do llms.txt são os de DEFAULT_LANDING_PLANS', () => {
  for (const plan of DEFAULT_LANDING_PLANS) {
    assert.ok(llms.includes(plan.price), `preço ${plan.price} (${plan.name}) não aparece no llms.txt`)
    assert.ok(llms.includes(plan.name), `plano ${plan.name} não aparece no llms.txt`)
  }
  assert.doesNotMatch(llms, /R\$\s?(29|49|59|79|89|97|99)\b/, 'preço que não existe no produto')
})

test('as 6 lojas aparecem por nome', () => {
  for (const loja of SUPPORTED_STORES) assert.ok(llms.includes(loja), `loja ${loja} não aparece`)
  assert.match(llms, /6 lojas|six stores/)
})

test('as páginas de venda estão listadas (Tier 1 por loja, preços, confiança, comerciais que convertem)', () => {
  for (const p of [
    '/shopee-afiliados-whatsapp', '/mercado-livre-afiliados-whatsapp', '/amazon-afiliados-whatsapp', '/shein-afiliados-whatsapp', '/magalu-afiliados-whatsapp',
    '/precos', '/espelha-grupos-e-confiavel', '/bot-afiliados-whatsapp', '/bot-achadinhos-whatsapp', '/automatizar-divulgacao-em-grupos-whatsapp', '/quem-somos',
  ]) {
    assert.ok(llms.includes(`${SITE}${p}`), `${p} não está no llms.txt`)
  }
})

test('toda URL do llms.txt existe no registro SEO (ou é arquivo/página estática conhecida)', () => {
  const indexable = new Set(getIndexableSeoRoutes().map((r) => r.path))
  const urls = [...new Set([...llms.matchAll(/https:\/\/espelhagrupos\.com\.br(\/[^\s)]*)?/g)].map((m) => m[1] || '/'))]
  assert.ok(urls.length > 30, `poucas URLs (${urls.length})`)
  const faltando = urls.filter((p) => !indexable.has(p) && !STATIC_OK.has(p))
  assert.deepEqual(faltando, [], `URLs que não existem como rota indexável: ${faltando.join(', ')}`)
  for (const p of urls) assert.doesNotMatch(p, /^\/(painel|admin|api\/(?!public))/, `rota privada no llms.txt: ${p}`)
})

test('o nome antigo só entra como "nome anterior", nunca como marca', () => {
  const hits = (llms.match(/BOTinho/g) || []).length
  assert.ok(hits <= 2, `BOTinho aparece ${hits}× — só a linha de desambiguação pode citá-lo`)
  assert.match(llms, /Preferred citation: Espelha Grupos/)
  assert.doesNotMatch(llms, /garant\w* (que )?n[ãa]o (ser[áa] )?ban/i, 'promessa anti-ban')
})
