// Regra PURA da medição de citação por IA (sem rede, sem banco).
//
// Consumida por scripts/medir-citacao-ia.mjs, que só faz a chamada à API e
// imprime. As consultas são as do roteiro canônico
// (docs/marketing/ROTEIRO_MEDICAO_IA.md) — teste falha se as duas listas
// divergirem, porque série com texto de pergunta diferente não compara.

export const ROUND_QUERIES = Object.freeze([
  { query: 'bot para afiliados no WhatsApp', cluster: 'categoria' },
  { query: 'ferramenta para divulgar ofertas em grupos de WhatsApp', cluster: 'categoria' },
  { query: 'como espelhar mensagens entre grupos de WhatsApp', cluster: 'categoria' },
  { query: 'como postar em vários grupos de WhatsApp ao mesmo tempo sem spam', cluster: 'categoria' },
  { query: 'como padronizar divulgação de cupons no WhatsApp', cluster: 'categoria' },
  { query: 'espelha grupos whatsapp o que é', cluster: 'marca' },
  { query: 'espelha grupos preço', cluster: 'marca' },
  { query: 'espelha grupos é confiável', cluster: 'marca' },
  { query: 'espelha grupos metodologia WhatsApp', cluster: 'marca' },
  { query: 'BOTinho preço', cluster: 'contaminacao' },
  // Trilha D — intenção de compra (série desde 10/2026; ver ROTEIRO §Trilha D).
  { query: 'melhor bot para afiliado shopee no whatsapp', cluster: 'compra' },
  { query: 'robô que busca ofertas da shopee sozinho', cluster: 'compra' },
  { query: 'automação para afiliados no whatsapp', cluster: 'compra' },
  { query: 'espelhar grupos de ofertas whatsapp vale a pena', cluster: 'compra' },
  { query: 'ferramenta para afiliada divulgar ofertas em grupos de whatsapp', cluster: 'compra' },
  { query: 'bot de achadinhos para whatsapp', cluster: 'compra' },
  { query: 'como ser afiliada shopee e divulgar no whatsapp', cluster: 'compra' },
  { query: 'espelha grupos ou afilira', cluster: 'compra' },
])

// B15 — linha de base pontual anterior às mudanças do backlog Pro Afiliados.
// Não entra nas séries A–D: responde objeções específicas e fica separada para
// que quatro consultas novas não alterem o denominador histórico.
export const PROAFILIADOS_BASELINE_QUERIES = Object.freeze([
  { query: 'existe bot grátis para afiliados no WhatsApp', cluster: 'b15' },
  { query: 'bot para afiliados com Telegram', cluster: 'b15' },
  { query: 'bot para afiliados que mostra comissão por grupo', cluster: 'b15' },
  { query: 'proafiliados vale a pena', cluster: 'b15' },
])

// A11 — consultas sobre o Afilira (concorrente que cresce por SEO e GEO), na
// rodada de 27/10. Conjunto separado, como o B15: não entra nas séries A–D
// nem muda o denominador histórico.
export const AFILIRA_BASELINE_QUERIES = Object.freeze([
  { query: 'Afilira', cluster: 'afilira' },
  { query: 'melhor bot de afiliados para WhatsApp', cluster: 'afilira' },
  { query: 'alternativa ao Afilira', cluster: 'afilira' },
])

// Nomes citados pelas IAs que ainda não têm ficha em competitors-data.js.
// O script soma estes aos nomes das fichas.
export const EXTRA_COMPETITOR_NAMES = Object.freeze([
  'Easyfy', 'LucreShop', 'AfiliAI', 'Achify', 'Afiliados Turbo', 'Ofertiva',
  'SpreApp', 'Replicazap', 'Notifish', 'Zap Multigrupos', 'GoGoBot',
  'Pai das Ofertas', 'BotConversa', 'Afiliados Pro Bot', 'Evolution API',
  'Manychat', 'Growify', 'Sincro',
])

const OUR_DOMAIN = 'espelhagrupos'
const BRAND_RE = /espelha\s*grupos|espelhagrupos/i

export function buildGeminiRequest(query) {
  return {
    contents: [{ role: 'user', parts: [{ text: String(query) }] }],
    tools: [{ google_search: {} }],
  }
}

function hostOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// A URI da fonte costuma ser um redirecionamento do Google; o domínio real vem
// no título (e, em versões novas da API, no campo `domain`).
function sourceLabel(web) {
  if (!web || typeof web !== 'object') return null
  return String(web.domain || web.title || hostOf(web.uri) || '').trim() || null
}

export function parseGeminiResponse(payload) {
  const candidate = payload?.candidates?.[0]
  const text = (candidate?.content?.parts || [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()
  const grounding = candidate?.groundingMetadata || {}
  const sources = (grounding.groundingChunks || [])
    .map((chunk) => sourceLabel(chunk?.web))
    .filter(Boolean)
  const searchQueries = Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries.map(String) : []
  return { text, sources: [...new Set(sources)], searchQueries }
}

export function findCompetitors(text, names) {
  const haystack = String(text || '').toLowerCase()
  const found = []
  for (const name of names || []) {
    const clean = String(name || '').trim()
    if (clean && haystack.includes(clean.toLowerCase()) && !found.includes(clean)) found.push(clean)
  }
  return found
}

// sim     = nosso domínio está entre as fontes, ou o texto traz o endereço;
//           em consulta que NÃO contém a marca, citar o nome também conta.
// parcial = consulta de marca em que o nome aparece no texto sem fonte nossa:
//           a pergunta já tinha o nome, então repeti-lo não prova que ela nos achou.
// nao     = nenhum dos dois.
// Consulta que JÁ traz a marca (Trilha B, ou a #18 da Trilha D "espelha grupos
// ou afilira"): o nome repetido sem fonte nossa é `parcial`, nunca `sim`.
export function classifyCitation({ cluster, text, sources, query = '' }) {
  const answer = String(text || '')
  const fromSources = (sources || []).some((label) => String(label).toLowerCase().includes(OUR_DOMAIN))
  const hasDomainInText = answer.toLowerCase().includes('espelhagrupos.com.br')
  if (fromSources || hasDomainInText) return 'sim'
  if (!BRAND_RE.test(answer)) return 'nao'
  const queryHasBrand = BRAND_RE.test(String(query || ''))
  return cluster === 'marca' || queryHasBrand ? 'parcial' : 'sim'
}

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsvRow(fields) {
  return fields.map(csvCell).join(',')
}

export function buildTrackingRow({ query, cluster, date, model, parsed, competitorNames }) {
  const cited = classifyCitation({ cluster, text: parsed.text, sources: parsed.sources, query })
  const competitors = findCompetitors(parsed.text, competitorNames).join('; ')
  const summary = parsed.text.replace(/\s+/g, ' ').slice(0, 400)
  const notes = [
    `Gerado por script (Gemini API com busca Google, modelo ${model}); revisar antes de entrar no placar.`,
    parsed.searchQueries.length ? `Buscou: ${parsed.searchQueries.slice(0, 5).join(' | ')}.` : 'Sem busca registrada.',
    parsed.sources.length ? `Fontes: ${parsed.sources.slice(0, 8).join(', ')}.` : 'Sem fonte.',
    `Resposta: ${summary}`,
  ].join(' ')
  return toCsvRow([
    query,
    cluster,
    'Gemini API (busca Google)',
    date,
    parsed.text ? 'sim' : 'nao',
    cited,
    cited === 'sim' && parsed.sources.some((s) => s.toLowerCase().includes(OUR_DOMAIN)) ? 'espelhagrupos.com.br' : '',
    competitors,
    notes,
    'revisar',
    'marketing',
  ])
}
