// Validador do CSV de medição de citação por IA
// (docs/marketing/ai_visibility_tracking.csv). PURO: recebe o texto, devolve
// erros e avisos — sem disco, sem rede.
//
// Por que existe (Issue 8 do PLANO_ISSUES_2026-09-10): um "SIM" maiúsculo
// zerou o placar de 01/09, porque a contagem compara com 'sim'. Linha fora do
// formato não dá erro nenhum — some da conta em silêncio, e a conclusão da
// rodada sai errada. Erro aqui é o que muda o placar; aviso é o que deixa a
// linha menos útil, mas não mente.

export const AI_VISIBILITY_HEADER = [
  'query', 'cluster', 'platform', 'checked_at', 'ai_answer_present',
  'botinho_cited', 'cited_url', 'competitors_cited', 'notes', 'next_action', 'owner',
]

// Trilhas do ROTEIRO_MEDICAO_IA.md. `contaminacao` é a Trilha C (nome antigo),
// que NUNCA pode ser registrada como `marca`. `indutora` é a pergunta que já
// cita o produto (regra 3 do roteiro): fica registrada, mas fora do placar.
export const AI_VISIBILITY_CLUSTERS = ['categoria', 'marca', 'problema', 'contaminacao', 'indutora']
export const AI_VISIBILITY_YES_NO = ['sim', 'nao']
export const AI_VISIBILITY_CITED = ['sim', 'nao', 'parcial']
// Superfícies medidas. O sufixo entre parênteses é permitido de propósito
// ("ChatGPT Search (conta neutra)", "ChatGPT (sem busca)") — é assim que o
// roteiro separa rodada logada de rodada neutra.
// A regra da Trilha C vale da primeira rodada feita DEPOIS do roteiro em
// diante. As rodadas de 01/09, 10/09 e 11/09 registraram "BOTinho" como marca
// e o roteiro manda NÃO reescrevê-las em silêncio ("registrar as duas leituras
// lado a lado") — por isso o histórico fica como está.
export const TRILHA_C_ENFORCED_AFTER = '2026-09-11'

export const AI_VISIBILITY_PLATFORMS = ['ChatGPT Search', 'ChatGPT', 'Google AI Overviews', 'Google Gemini', 'Perplexity']

// Parser de CSV com aspas (RFC 4180): campo entre aspas pode ter vírgula,
// quebra de linha e "" como aspas literais. As notas do arquivo usam as três.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text ?? '').replace(/^﻿/, '')
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i += 1 }
      else if (ch === '"') quoted = false
      else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (quoted) throw new Error('CSV com aspas abertas até o fim do arquivo')
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function platformIsKnown(platform) {
  const base = platform.replace(/\s*\(.*\)\s*$/, '').trim()
  return AI_VISIBILITY_PLATFORMS.includes(base)
}

export function validateAiVisibilityCsv(text, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = []
  const warnings = []
  let rows
  try {
    rows = parseCsv(text)
  } catch (error) {
    return { errors: [error.message], warnings, rowCount: 0 }
  }
  if (!rows.length) return { errors: ['arquivo vazio'], warnings, rowCount: 0 }

  const [header, ...data] = rows
  if (header.join(',') !== AI_VISIBILITY_HEADER.join(',')) {
    errors.push(`cabeçalho diferente do esperado: ${header.join(',')}`)
    return { errors, warnings, rowCount: data.length }
  }

  const seen = new Map()
  data.forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== AI_VISIBILITY_HEADER.length) {
      errors.push(`linha ${line}: ${cells.length} colunas (esperado ${AI_VISIBILITY_HEADER.length})`)
      return
    }
    const row = Object.fromEntries(AI_VISIBILITY_HEADER.map((key, i) => [key, cells[i]]))
    if (!row.query.trim()) errors.push(`linha ${line}: consulta vazia`)
    if (!AI_VISIBILITY_CLUSTERS.includes(row.cluster)) {
      errors.push(`linha ${line}: cluster "${row.cluster}" (use ${AI_VISIBILITY_CLUSTERS.join(', ')}, minúsculo)`)
    }
    if (!platformIsKnown(row.platform)) errors.push(`linha ${line}: plataforma desconhecida "${row.platform}"`)
    if (!isValidIsoDate(row.checked_at)) errors.push(`linha ${line}: data "${row.checked_at}" fora do formato AAAA-MM-DD`)
    else if (row.checked_at > today) errors.push(`linha ${line}: data ${row.checked_at} no futuro`)
    if (!AI_VISIBILITY_YES_NO.includes(row.ai_answer_present)) {
      errors.push(`linha ${line}: ai_answer_present "${row.ai_answer_present}" (use sim ou nao, minúsculo e sem acento)`)
    }
    if (!AI_VISIBILITY_CITED.includes(row.botinho_cited)) {
      errors.push(`linha ${line}: botinho_cited "${row.botinho_cited}" (use sim, nao ou parcial, minúsculo e sem acento)`)
    }
    // Endereço anotado com comentário ("espelhagrupos.com.br (âncora ...)") é
    // registro honesto de quando a IA não expõe o caminho: avisa, não barra.
    if (row.cited_url && !/^https?:\/\/\S+$/.test(row.cited_url.trim())) {
      warnings.push(`linha ${line}: cited_url não é um endereço completo: "${row.cited_url}"`)
    }
    // Trilha C medida como marca: exatamente a contaminação que o roteiro proíbe.
    if (row.cluster === 'marca' && /botinho/i.test(row.query) && row.checked_at > TRILHA_C_ENFORCED_AFTER) {
      errors.push(`linha ${line}: consulta com o nome antigo registrada como marca — é cluster contaminacao (Trilha C)`)
    }

    const key = `${row.query}|${row.platform}|${row.checked_at}`
    if (seen.has(key)) errors.push(`linha ${line}: repete a linha ${seen.get(key)} (mesma consulta, plataforma e data)`)
    else seen.set(key, line)

    if (row.botinho_cited === 'sim' && !row.cited_url.trim()) {
      warnings.push(`linha ${line}: citado sem a URL — anote qual página a IA usou`)
    }
  })

  return { errors, warnings, rowCount: data.length }
}
