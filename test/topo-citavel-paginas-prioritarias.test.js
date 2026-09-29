// Topo das 20 páginas prioritárias no padrão citado (29/09/2026 — item 4 da
// seção 6 do PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md): resposta afirmativa
// nas 3 primeiras linhas (o que é, para quem, quanto custa), 1-2 números
// próprios COM fonte, cabeçalho em pergunta. Três coisas não regridem:
//  1. preço escrito à mão no topo (sai de DEFAULT_LANDING_PLANS);
//  2. número próprio sem data e sem origem;
//  3. uma página prioritária perder o bloco.
// Fonte lida como texto onde há JSX/aliases (@/), como nas outras guardas.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { DEFAULT_LANDING_PLANS } from '../dashboard/lib/marketing-content.js'
import {
  CUSTO_FRASE,
  NUMEROS_MEDIDOS_EM,
  NUMEROS_PROPRIOS,
  PRECO_PLANOS_FRASE,
  fraseNumerosProprios,
} from '../dashboard/lib/resposta-citavel.js'

const ler = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('preço do topo vem dos planos reais, nunca de valor inventado', () => {
  for (const plan of DEFAULT_LANDING_PLANS.filter((p) => Number(p.priceValue) > 0)) {
    assert.ok(PRECO_PLANOS_FRASE.includes(`${plan.name} ${plan.price}`), `${plan.name} fora da frase de preço`)
  }
  assert.ok(CUSTO_FRASE.includes(PRECO_PLANOS_FRASE))
  assert.match(CUSTO_FRASE, /7 dias grátis/)
})

test('números próprios saem com fonte e data, e sem citação entre aspas inventada', () => {
  const frase = fraseNumerosProprios()
  assert.match(NUMEROS_MEDIDOS_EM, /^\d{4}-\d{2}-\d{2}$/)
  const [ano, mes, dia] = NUMEROS_MEDIDOS_EM.split('-')
  assert.ok(frase.includes(`${dia}/${mes}/${ano}`), 'a frase precisa trazer a data da medição')
  assert.match(frase, /fonte:/)
  assert.ok(frase.includes(String(NUMEROS_PROPRIOS.clientesPagantes)))
  assert.ok(frase.includes(NUMEROS_PROPRIOS.renovacaoAgosto))
  assert.doesNotMatch(frase, /["“”]/, 'nenhuma citação entre aspas sem fonte verificável')
})

const COMERCIAIS = [
  'shopee-afiliados-whatsapp', 'mercado-livre-afiliados-whatsapp', 'amazon-afiliados-whatsapp',
  'magalu-afiliados-whatsapp', 'shein-afiliados-whatsapp', 'bot-que-busca-ofertas-shopee-whatsapp',
  'bot-afiliados-whatsapp', 'bot-achadinhos-whatsapp', 'anti-ban-whatsapp', 'grupo-para-canal-whatsapp',
  'bot-canal-whatsapp',
]

test('páginas comerciais: "para quem é" + "quanto custa" + números logo abaixo do lead', () => {
  const fonte = ler('dashboard/app/_preservationCommercialPages.js')
  for (const chave of COMERCIAIS) {
    const inicio = fonte.indexOf(`  '${chave}': {`)
    assert.ok(inicio > -1, `${chave} sumiu`)
    const fim = fonte.indexOf("\n  '", inicio + 5)
    assert.match(fonte.slice(inicio, fim), /\n    forWhom: /, `${chave}: sem "para quem é"`)
  }
  // "Vale a pena?" já responde para quem e quanto custa dentro do lead (27/09).
  const valeInicio = fonte.indexOf("  'espelhar-grupos-de-ofertas-vale-a-pena': {")
  assert.match(fonte.slice(valeInicio, fonte.indexOf("\n  '", valeInicio + 5)), /custa \$\{precoPlanosFrase\}/)
  assert.match(fonte, /<strong>Quanto custa:<\/strong> \{CUSTO_FRASE\}/)
  assert.match(fonte, /\{fraseNumerosProprios\(\)\}/)
  assert.match(fonte, /title="O que você precisa saber antes de decidir\?"/)
  assert.match(fonte, /title="Para quem é o Espelha Grupos, e para quem não é\?"/)
})

test('comparativos prioritários: resposta curta com pergunta, preço das constantes e números', () => {
  const fonte = ler('dashboard/app/_comparisonContent.js')
  for (const slug of ['/alternativas/achadinhos-bot', '/alternativas/achadinho-pro', '/alternativas/bot-para-whatsapp-afiliados']) {
    const inicio = fonte.indexOf(`  '${slug}': {`)
    const bloco = fonte.slice(inicio, fonte.indexOf("\n  '/", inicio + 5))
    assert.match(bloco, /answerQuestion: '[^']+\?'/, `${slug}: resposta curta sem pergunta`)
  }
  assert.match(fonte, /title=\{page\.answerQuestion \|\| 'A resposta curta'\}/)
  assert.match(fonte, /page\.answerQuestion \? \([\s\S]{0,200}fraseNumerosProprios\(\)/)
})

test('demais páginas prioritárias trazem os números com fonte e o cabeçalho em pergunta', () => {
  const casos = [
    ['dashboard/app/metodologia-uso-responsavel-whatsapp/page.js', /<h2>O que é a metodologia do \{BRAND_NAME\}, e para quem ela vale\?<\/h2>/],
    ['dashboard/app/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo/page.js', /<h2>Dá para postar em vários grupos ao mesmo tempo sem virar spam\?<\/h2>/],
    ['dashboard/app/precos/page.js', /Quanto custa o robô de ofertas/],
    ['dashboard/app/_seoHubShared.js', /introQuestion: '[^']+\?'/],
  ]
  for (const [rel, cabecalho] of casos) {
    const fonte = ler(rel)
    assert.match(fonte, /fraseNumerosProprios\(\)/, `${rel}: sem números próprios com fonte`)
    assert.match(fonte, cabecalho, `${rel}: cabeçalho em pergunta sumiu`)
  }
  const confiavel = ler('dashboard/app/espelha-grupos-e-confiavel/page.js')
  assert.match(confiavel, /<h2>O que é o \{BRAND_NAME\}, para quem é e quanto custa\?<\/h2>/)
  assert.match(confiavel, /Fonte: dados internos do \{BRAND_NAME\}/, 'número sem fonte em /espelha-grupos-e-confiavel')
})
