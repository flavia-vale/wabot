import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AWIN_STORE_EXAMPLES,
  BRAND_DEFINITION_PT,
  CORE_FAQ_ITEMS,
  DEFAULT_LANDING_PLANS,
  RAKUTEN_STORE_EXAMPLES,
  STORES_FACT_PT,
  SUPPORTED_STORES,
} from '../dashboard/lib/marketing-content.js'

// Análise SEO+GEO de 02/10/2026, G1 (Frente 1, item 1): site e llms.txt
// diziam só "6 lojas" e a Visão geral de IA do Google repetia isso, ignorando
// as lojas da Awin e da Rakuten que o produto já converte. O fato "lojas" vira
// UMA frase (STORES_FACT_PT) e as fontes de verdade passam a citá-la.

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8')

test('a frase única cita as 6 lojas, a Awin, a Rakuten e as lojas de exemplo', () => {
  for (const loja of [...SUPPORTED_STORES, ...AWIN_STORE_EXAMPLES, ...RAKUTEN_STORE_EXAMPLES]) {
    assert.ok(STORES_FACT_PT.includes(loja), `STORES_FACT_PT sem ${loja}`)
  }
  assert.match(STORES_FACT_PT, /^6 lojas com código próprio \(/)
  assert.match(STORES_FACT_PT, /aprovada na Awin .* e na Rakuten/)
})

test('definição da marca, FAQ de lojas e plano Basic citam Awin e Rakuten', () => {
  assert.match(BRAND_DEFINITION_PT, /Awin e na Rakuten/)
  const programas = CORE_FAQ_ITEMS.find((item) => item.id === 'faq_seed_programs')
  assert.match(programas.answer, /Awin/)
  assert.match(programas.answer, /Rakuten/)
  const basic = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'basic')
  assert.ok(basic.features.some((f) => /Awin/.test(f) && /Rakuten/.test(f)), 'plano Basic sem Awin/Rakuten na lista de recursos')
})

test('llms.txt e pricing.md trazem a frase única; nenhuma linha fala só em "6 lojas" como fato fechado', () => {
  for (const rel of ['dashboard/public/llms.txt', 'dashboard/public/pricing.md']) {
    const texto = ler(rel)
    assert.ok(texto.includes(STORES_FACT_PT), `${rel} sem a frase única de lojas`)
    assert.doesNotMatch(texto, /\(6 lojas\)\.|six stores, on every plan including/, `${rel} ainda fecha o fato em 6 lojas`)
  }
})

test('home, /quem-somos, /precos e o hub de automação leem a frase da constante', () => {
  for (const rel of [
    'dashboard/components/landing/Features.jsx',
    'dashboard/app/quem-somos/page.js',
    'dashboard/app/precos/page.js',
    'dashboard/app/_seoHubShared.js',
  ]) {
    assert.match(ler(rel), /STORES_FACT_PT/, `${rel} não usa STORES_FACT_PT`)
  }
  assert.match(ler('dashboard/app/page.js'), /Awin e da Rakuten/, 'meta description da home sem Awin/Rakuten')
})
