import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ROUND_QUERIES,
  buildGeminiRequest,
  parseGeminiResponse,
  classifyCitation,
  findCompetitors,
  buildTrackingRow,
} from '../src/ops/aiCitation.js'

test('as consultas do script são exatamente as 10 do roteiro canônico', () => {
  const roteiro = readFileSync(new URL('../docs/marketing/ROTEIRO_MEDICAO_IA.md', import.meta.url), 'utf8')
  const numbered = [...roteiro.matchAll(/^(\d+)\. (.+)$/gm)]
    .filter(([, n]) => Number(n) <= 10)
    .map(([, , text]) => text.replace(/\*\*/g, '').replace(/\s*\*\(.*\)\*\s*$/, '').trim())
  assert.deepEqual(ROUND_QUERIES.map((q) => q.query), numbered.slice(0, 10))
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
