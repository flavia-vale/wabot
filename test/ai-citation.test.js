import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ROUND_QUERIES,
  PROAFILIADOS_BASELINE_QUERIES,
  AFILIRA_BASELINE_QUERIES,
  buildGeminiRequest,
  parseGeminiResponse,
  classifyCitation,
  findCompetitors,
  buildTrackingRow,
} from '../src/ops/aiCitation.js'

test('as consultas do script são exatamente as 18 do roteiro canônico (A, B, C e D)', () => {
  const roteiro = readFileSync(new URL('../docs/marketing/ROTEIRO_MEDICAO_IA.md', import.meta.url), 'utf8')
  const numbered = [...roteiro.matchAll(/^(\d+)\. (.+)$/gm)]
    .filter(([, n]) => Number(n) <= 18)
    .map(([, , text]) => text.replace(/\*\*/g, '').replace(/\s*\*\(.*\)\*\s*$/, '').trim())
  assert.deepEqual(ROUND_QUERIES.map((q) => q.query), numbered.slice(0, 18))
  assert.equal(ROUND_QUERIES.filter((q) => q.cluster === 'compra').length, 8)
})

test('B15 tem quatro consultas separadas da série histórica', () => {
  assert.deepEqual(PROAFILIADOS_BASELINE_QUERIES.map((item) => item.query), [
    'existe bot grátis para afiliados no WhatsApp',
    'bot para afiliados com Telegram',
    'bot para afiliados que mostra comissão por grupo',
    'proafiliados vale a pena',
  ])
  assert.ok(PROAFILIADOS_BASELINE_QUERIES.every((item) => item.cluster === 'b15'))
})

test('pede a busca do Google na requisição', () => {
  assert.deepEqual(buildGeminiRequest('x').tools, [{ google_search: {} }])
})

test('lê texto, fontes e buscas da resposta', () => {
  const parsed = parseGeminiResponse({
    candidates: [{
      content: { parts: [{ text: 'O Espelha ' }, { text: 'Grupos custa R$39.' }] },
      groundingMetadata: {
        webSearchQueries: ['espelha grupos preço'],
        groundingChunks: [
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'espelhagrupos.com.br' } },
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/def', title: 'espelhagrupos.com.br' } },
          { web: { uri: 'https://afilira.com/', title: '' } },
        ],
      },
    }],
  })
  assert.equal(parsed.text, 'O Espelha Grupos custa R$39.')
  assert.deepEqual(parsed.sources, ['espelhagrupos.com.br', 'afilira.com'])
  assert.deepEqual(parsed.searchQueries, ['espelha grupos preço'])
})

test('resposta vazia ou quebrada não derruba a leitura', () => {
  assert.deepEqual(parseGeminiResponse({}), { text: '', sources: [], searchQueries: [] })
  assert.deepEqual(parseGeminiResponse(null), { text: '', sources: [], searchQueries: [] })
})

test('fonte nossa é citação em qualquer trilha', () => {
  assert.equal(classifyCitation({ cluster: 'marca', text: 'algo', sources: ['espelhagrupos.com.br'] }), 'sim')
})

test('em consulta de marca, repetir o nome sem fonte é só parcial', () => {
  assert.equal(classifyCitation({ cluster: 'marca', text: 'Espelhar grupos (espelha grupos) é copiar mensagens', sources: [] }), 'parcial')
})

test('em consulta de categoria, citar o nome já conta', () => {
  assert.equal(classifyCitation({ cluster: 'categoria', text: 'Opções: Espelha Grupos, Afilira', sources: [] }), 'sim')
  assert.equal(classifyCitation({ cluster: 'categoria', text: 'Opções: Afilira', sources: ['afilira.com'] }), 'nao')
  // Trilha D: consulta sem a marca conta o nome; consulta COM a marca ('espelha grupos ou afilira') só conta com fonte nossa.
  assert.equal(classifyCitation({ cluster: 'compra', query: 'bot de achadinhos para whatsapp', text: 'Use o Espelha Grupos', sources: [] }), 'sim')
  assert.equal(classifyCitation({ cluster: 'compra', query: 'espelha grupos ou afilira', text: 'O Espelha Grupos é mais barato', sources: [] }), 'parcial')
  assert.equal(classifyCitation({ cluster: 'compra', query: 'espelha grupos ou afilira', text: 'O Espelha Grupos é mais barato', sources: ['espelhagrupos.com.br'] }), 'sim')
})

test('acha concorrentes sem repetir e sem diferenciar maiúsculas', () => {
  assert.deepEqual(findCompetitors('afilira e SHOZAP e Afilira', ['Afilira', 'Shozap', 'Busqy']), ['Afilira', 'Shozap'])
})

test('linha do CSV tem as 11 colunas da planilha e escapa vírgula e aspas', () => {
  const row = buildTrackingRow({
    query: 'espelha grupos preço',
    cluster: 'marca',
    date: '2026-09-30',
    model: 'm',
    parsed: { text: 'Basic R$39, "Pro" R$69', sources: ['espelhagrupos.com.br'], searchQueries: [] },
    competitorNames: [],
  })
  const cells = row.match(/("([^"]|"")*"|[^,]*)(,|$)/g).filter((c) => c !== '')
  assert.equal(cells.length, 11)
  assert.ok(row.startsWith('espelha grupos preço,marca,Gemini API (busca Google),2026-09-30,sim,sim,espelhagrupos.com.br,'))
  assert.ok(row.includes('""Pro""'))
})

test('A11 tem três consultas sobre o Afilira, separadas das séries A–D e do B15', () => {
  assert.deepEqual(AFILIRA_BASELINE_QUERIES.map((item) => item.query), [
    'Afilira',
    'melhor bot de afiliados para WhatsApp',
    'alternativa ao Afilira',
  ])
  assert.ok(AFILIRA_BASELINE_QUERIES.every((item) => item.cluster === 'afilira'))
  const nasSeries = new Set(ROUND_QUERIES.map((q) => q.query))
  assert.ok(AFILIRA_BASELINE_QUERIES.every((item) => !nasSeries.has(item.query)))
})
