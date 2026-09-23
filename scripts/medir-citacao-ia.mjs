#!/usr/bin/env node
/**
 * Medição de citação por IA — Gemini com busca Google, sem abrir o navegador.
 *
 * Roda as 10 consultas do roteiro (docs/marketing/ROTEIRO_MEDICAO_IA.md) na API
 * do Gemini com a ferramenta de busca ligada e imprime uma linha por consulta no
 * formato de docs/marketing/ai_visibility_tracking.csv. A regra de "citou ou
 * não" mora em src/ops/aiCitation.js; aqui só há rede e impressão.
 *
 * O que ele NÃO faz: não grava no repositório (a saída vai para a tela ou para o
 * arquivo que você indicar), não usa banco, não imprime a chave.
 *
 * ⚠️ API não é o aplicativo: a resposta pela API pode diferir do gemini.google.com.
 * Por isso a plataforma sai como "Gemini API (busca Google)" e não se mistura com
 * as linhas "Google Gemini" das rodadas manuais.
 *
 * Uso:
 *   GEMINI_API_KEY=... node scripts/medir-citacao-ia.mjs
 *   GEMINI_API_KEY=... node scripts/medir-citacao-ia.mjs --saida=/tmp/gemini.csv --json=/tmp/gemini.json
 *   GEMINI_MODEL=<modelo> ...    # troca o modelo se o padrão for aposentado
 *   --so=3                       # roda só a consulta 3 (1 a 10), para testar
 */

import { writeFileSync } from 'node:fs'
import { ROUND_QUERIES, EXTRA_COMPETITOR_NAMES, buildGeminiRequest, parseGeminiResponse, buildTrackingRow } from '../src/ops/aiCitation.js'

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const apiKey = process.env.GEMINI_API_KEY
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const outCsv = arg('saida', null)
const outJson = arg('json', null)
const only = Number(arg('so', 0))
const pauseMs = Number(arg('pausa', 3000))
const date = new Date().toISOString().slice(0, 10)

if (!apiKey) {
  console.error('Falta a chave: rode com GEMINI_API_KEY=<sua chave> (crie em https://aistudio.google.com/apikey).')
  process.exit(2)
}

async function competitorNames() {
  try {
    const { listCompetitors } = await import('../dashboard/lib/competitors-data.js')
    return [...listCompetitors().map((c) => c.name), ...EXTRA_COMPETITOR_NAMES]
  } catch (error) {
    console.error(`Aviso: não li as fichas de concorrentes (${error.message}); usando só a lista extra.`)
    return [...EXTRA_COMPETITOR_NAMES]
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function ask(query) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiRequest(query)),
      signal: AbortSignal.timeout(90000),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return body
    const message = body?.error?.message || `HTTP ${res.status}`
    if (res.status === 429 && attempt === 1) {
      console.error(`  limite da API atingido; esperando 30s e tentando de novo (${message})`)
      await sleep(30000)
      continue
    }
    if (res.status === 404) throw new Error(`modelo "${model}" não encontrado — defina GEMINI_MODEL com um modelo atual. (${message})`)
    throw new Error(message)
  }
  throw new Error('limite da API atingido duas vezes')
}

const names = await competitorNames()
const selected = only ? ROUND_QUERIES.filter((_, i) => i + 1 === only) : ROUND_QUERIES
const rows = []
const raw = []
let failures = 0

for (const [index, item] of selected.entries()) {
  console.error(`[${index + 1}/${selected.length}] ${item.query}`)
  try {
    const payload = await ask(item.query)
    const parsed = parseGeminiResponse(payload)
    rows.push(buildTrackingRow({ ...item, date, model, parsed, competitorNames: names }))
    raw.push({ ...item, ...parsed })
  } catch (error) {
    failures += 1
    console.error(`  falhou: ${error.message}`)
  }
  if (index < selected.length - 1) await sleep(pauseMs)
}

const csv = rows.join('\r\n') + (rows.length ? '\r\n' : '')
if (outCsv) writeFileSync(outCsv, csv)
else process.stdout.write(csv)
if (outJson) writeFileSync(outJson, JSON.stringify({ date, model, answers: raw }, null, 2))

console.error(`\n${rows.length} de ${selected.length} consultas medidas${failures ? `, ${failures} falharam` : ''}.`)
process.exit(rows.length ? 0 : 1)
