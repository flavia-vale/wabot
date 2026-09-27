import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LANDING_PLANS, SUPPORTED_STORES } from '../dashboard/lib/marketing-content.js'
import {
  FICHA_COLUNAS,
  FICHA_DEFINICAO,
  FICHA_FATOS,
  FICHA_LINHAS,
  renderFichaTecnicaMarkdown,
} from '../dashboard/lib/ficha-tecnica.js'
import { getPlanEntitlements } from '../src/billing/plans.js'

// Medição de IA de 27/09/2026 ("bot para afiliados no WhatsApp"): a Perplexity
// nos listava com "Lojas suportadas: variam"; o Gemini dizia que enviamos para
// "WhatsApp e Telegram" e que o Basic é "operação manual". A resposta é UMA
// ficha técnica, derivada das constantes, idêntica na home, em /precos, no
// llms.txt e no pricing.md. Esta guarda falha se qualquer cópia divergir —
// `test/llms-txt-sync.test.js` já cobre preço/lojas/URLs do llms.txt em geral;
// aqui o que importa é o BLOCO ser o mesmo nos 4 lugares e bater com o código.

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8')
const bloco = renderFichaTecnicaMarkdown()

test('llms.txt e pricing.md contêm o bloco canônico byte a byte (regenerar com renderFichaTecnicaMarkdown)', () => {
  for (const rel of ['dashboard/public/llms.txt', 'dashboard/public/pricing.md']) {
    assert.ok(ler(rel).includes(bloco), `${rel} diverge da ficha canônica — cole a saída de renderFichaTecnicaMarkdown() no lugar do bloco antigo`)
  }
})

test('home e /precos renderizam o MESMO componente, que lê só de lib/ficha-tecnica.js', () => {
  for (const rel of ['dashboard/app/page.js', 'dashboard/app/precos/page.js']) {
    const fonte = ler(rel)
    assert.match(fonte, /import \{ FichaTecnica \} from '@\/components\/landing\/FichaTecnica'/, `${rel} não importa FichaTecnica`)
    assert.match(fonte, /<FichaTecnica \/>/, `${rel} não renderiza <FichaTecnica />`)
  }
  const componente = ler('dashboard/components/landing/FichaTecnica.jsx')
  assert.match(componente, /from '@\/lib\/ficha-tecnica'/)
  assert.doesNotMatch(componente, /'use client'/, 'a ficha precisa sair no HTML do servidor — é o que a IA lê')
  for (const loja of SUPPORTED_STORES) assert.ok(!componente.includes(loja), `loja "${loja}" escrita à mão no componente — deve vir da constante`)
})

test('a definição é uma só, cita as lojas pela constante e os 3 modelos (espelhar, criar a partir do link, garimpar)', () => {
  assert.match(FICHA_DEFINICAO, /^Espelha Grupos é um software web para afiliadas/)
  assert.ok(FICHA_DEFINICAO.includes(`${SUPPORTED_STORES.length} lojas`))
  // Plano GEO 27/09/2026 §3: a Perplexity classifica o mercado em espelhador,
  // formatador e garimpo automático — a frase precisa nomear os três.
  assert.match(FICHA_DEFINICAO, /espelha ofertas de grupos e canais do WhatsApp/)
  assert.match(FICHA_DEFINICAO, /cria a oferta a partir de um link/)
  assert.match(FICHA_DEFINICAO, /\(no Pro\) busca ofertas da Shopee sozinho/)
  assert.doesNotMatch(FICHA_DEFINICAO, /Telegram|anti-?ban|BOTinho/i)
  const lojas = FICHA_FATOS.find((f) => f.rotulo === 'Lojas com conversão de link')
  for (const loja of SUPPORTED_STORES) assert.ok(lojas.valor.includes(loja), `fato de lojas sem ${loja}`)
  assert.match(lojas.valor, /cupom/)
})

test('a MESMA frase de definição abre /quem-somos e /espelha-grupos-e-confiavel (constante, não texto à mão)', () => {
  // A3 do plano GEO de 27/09/2026: "o que é" precisa sair idêntico, byte a
  // byte, em todo lugar que define o produto — inclusive nas duas páginas que
  // as IAs leem quando perguntam "o que é" e "é confiável".
  for (const rel of ['dashboard/app/quem-somos/page.js', 'dashboard/app/espelha-grupos-e-confiavel/page.js']) {
    const fonte = ler(rel)
    assert.match(fonte, /import \{[^}]*\bFICHA_DEFINICAO\b[^}]*\} from '@\/lib\/ficha-tecnica'/, `${rel} não importa FICHA_DEFINICAO`)
    assert.match(fonte, /\{FICHA_DEFINICAO\}/, `${rel} não renderiza FICHA_DEFINICAO`)
    assert.ok(!fonte.includes('é um software brasileiro de divulgação'), `${rel}: frase de abertura ainda escrita à mão`)
  }
})

test('os 3 fatos que a IA pedia (palavras bloqueadas, imagem/card, criar oferta pelo link) estão na ficha, nos dois planos', () => {
  // Medição de 27/09/2026: o Gemini listava "filtro de palavras-chave" e
  // "preserva imagem/card" como ausentes; a Perplexity não sabia do modelo
  // "formatador". Os três existem sem cadeado de plano: `blockedKeywords` em
  // src/api/routes/{config,groups}.js, src/core/previewCardCanvas.js e
  // /painel/criar-oferta (+ /api/link-conversion/scrape-offer).
  for (const trecho of ['Palavras bloqueadas', 'Imagem e card da oferta preservados', 'Criar oferta a partir de um link']) {
    const linha = FICHA_LINHAS.find((l) => l.recurso.startsWith(trecho))
    assert.ok(linha, `linha "${trecho}" sumiu da ficha`)
    assert.equal(linha.basic, true, `${trecho}: não tem gate de plano no código, precisa ser Sim no Basic`)
    assert.equal(linha.pro, true)
  }
})

test('só WhatsApp: a ficha nega Telegram e Instagram e nunca promete não banir', () => {
  const canal = FICHA_FATOS.find((f) => f.rotulo === 'Canal de publicação')
  assert.match(canal.valor, /Só WhatsApp/)
  assert.match(canal.valor, /Não envia para Telegram nem para Instagram/)
  assert.doesNotMatch(bloco, /garant\w* (que )?(o número )?n[ãa]o (ser[áa] )?ban/i, 'promessa anti-ban')
  assert.match(bloco, /Nenhum software garante/)
})

test('colunas carregam nome, preço e período de DEFAULT_LANDING_PLANS', () => {
  const basic = DEFAULT_LANDING_PLANS.find((p) => p.id === 'basic')
  const pro = DEFAULT_LANDING_PLANS.find((p) => p.id === 'pro')
  assert.equal(FICHA_COLUNAS[1], `${basic.name} (${basic.price} / ${basic.period})`)
  assert.equal(FICHA_COLUNAS[2], `${pro.name} (${pro.price} / ${pro.period})`)
  assert.doesNotMatch(bloco, /R\$\s?(29|49|59|79|89|97|99)\b/, 'preço que não existe no produto')
})

test('a coluna Basic × Pro bate com os entitlements de src/billing/plans.js', () => {
  const basic = getPlanEntitlements('basic')
  const pro = getPlanEntitlements('pro')
  const porRecurso = (trecho) => FICHA_LINHAS.find((l) => l.recurso.includes(trecho))
  const casos = [
    ['Espelhamento automático', 'canUseGroups'],
    ['Canais do WhatsApp', 'canUseChannels'],
    ['Ofertas automáticas da Shopee', 'canUseOfferAutomations'],
    ['Filas de envio', 'canUseOfferQueues'],
    ['Variação do texto', 'canUseCopyVariation'],
    ['Marca d’água', 'canUseWatermark'],
    ['Painel de vendas e comissão da Shopee', 'canUseShopeeSales'],
  ]
  for (const [trecho, flag] of casos) {
    const linha = porRecurso(trecho)
    assert.ok(linha, `linha "${trecho}" sumiu da ficha`)
    assert.equal(linha.basic, basic[flag], `${trecho}: Basic diverge de ${flag}`)
    assert.equal(linha.pro, pro[flag], `${trecho}: Pro diverge de ${flag}`)
  }
  // O Basic também espelha sozinho (o Gemini dizia "operação manual").
  assert.equal(porRecurso('Espelhamento automático').basic, true)
  // Instagram só existiria num plano acima do Pro, que não é vendido: fora da ficha.
  assert.equal(pro.canUseInstagramStories, false)
  assert.ok(!FICHA_LINHAS.some((l) => /Instagram|Telegram/i.test(l.recurso)))
})

test('o bloco em Markdown tem uma linha por recurso e só Sim/Não nas colunas', () => {
  const linhasTabela = bloco.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Recurso'))
  assert.equal(linhasTabela.length, FICHA_LINHAS.length)
  for (const l of linhasTabela) assert.match(l, /\| (Sim|Não) \| (Sim|Não) \|$/)
})
