// Renderizador do texto dos e-mails. Puro: sem env, sem rede, sem banco.
//
// O corpo de cada e-mail é escrito num formato SIMPLES, pensado para a admin
// editar pelo painel sem saber HTML — e para o sistema nunca receber HTML cru
// de um campo de texto (tudo é escapado antes de virar HTML).
//
// Formato aceito:
//   - Linha em branco separa parágrafos.
//   - Linhas começando com "- " viram lista com marcador.
//   - Linhas começando com "1. " (qualquer número) viram lista numerada.
//   - [[botao:Rótulo|https://link]] vira o botão verde do Espelha Grupos.
//   - [texto](https://link) vira link no meio da frase.
//   - **texto** vira negrito.
//   - {{variavel}} é trocado pelo valor correspondente.

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
const BUTTON_RE = /^\[\[\s*botao\s*:\s*([^|]+)\|\s*([^\]]+)\]\]$/i
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const BOLD_RE = /\*\*([^*]+)\*\*/g

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Troca {{variaveis}} pelos valores. Variável sem valor vira string vazia e é
 * reportada em `missing` — o painel usa isso para avisar a admin antes de
 * salvar um texto com variável que não existe.
 * @param {string} template
 * @param {Record<string, any>} vars
 * @returns {{ output: string, missing: string[] }}
 */
export function applyVariables(template, vars = {}) {
  const missing = []
  const output = String(template ?? '').replace(VARIABLE_RE, (_match, name) => {
    const value = vars[name]
    if (value === undefined || value === null || value === '') {
      if (!missing.includes(name)) missing.push(name)
      return ''
    }
    return String(value)
  })
  return { output, missing }
}

/**
 * Lista as variáveis usadas num texto (para validação no painel).
 * @param {string} template
 * @returns {string[]}
 */
export function extractVariables(template) {
  const found = []
  for (const match of String(template ?? '').matchAll(VARIABLE_RE)) {
    if (!found.includes(match[1])) found.push(match[1])
  }
  return found
}

function inlineToHtml(line) {
  return escapeHtml(line)
    // O escape já rodou, então os marcadores chegam aqui intactos (não contêm
    // < > &) e o que veio do texto da admin já está neutralizado.
    .replace(LINK_RE, (_m, label, url) => `<a href="${sanitizeUrl(url)}" style="color:#16a34a">${label}</a>`)
    .replace(BOLD_RE, '<strong>$1</strong>')
}

function inlineToText(line) {
  return String(line)
    .replace(LINK_RE, (_m, label, url) => `${label}: ${url}`)
    .replace(BOLD_RE, '$1')
}

// Só http(s) e mailto viram link. Qualquer outra coisa (javascript:, data:)
// perde o href — o texto continua visível, mas não é clicável.
function sanitizeUrl(url) {
  const trimmed = String(url ?? '').trim()
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? escapeHtml(trimmed) : '#'
}

function splitBlocks(body) {
  return String(body ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
}

/**
 * Converte o corpo (já com as variáveis trocadas) em texto puro + HTML.
 * @param {string} body
 * @returns {{ text: string, html: string }}
 */
export function renderBody(body) {
  const blocks = splitBlocks(body)
  const textParts = []
  const htmlParts = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)

    const button = lines.length === 1 ? lines[0].match(BUTTON_RE) : null
    if (button) {
      const [, label, url] = button
      textParts.push(`${label.trim()}: ${url.trim()}`)
      htmlParts.push(`<p style="text-align:center;margin:28px 0"><a href="${sanitizeUrl(url)}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;display:inline-block">${escapeHtml(label.trim())}</a></p>`)
      continue
    }

    if (lines.every((line) => line.startsWith('- '))) {
      const items = lines.map((line) => line.slice(2).trim())
      textParts.push(items.map((item) => `- ${inlineToText(item)}`).join('\n'))
      htmlParts.push(`<ul style="font-size:15px;line-height:1.6;padding-left:20px">${items.map((item) => `<li style="margin-bottom:8px">${inlineToHtml(item)}</li>`).join('')}</ul>`)
      continue
    }

    if (lines.every((line) => /^\d+\.\s/.test(line))) {
      const items = lines.map((line) => line.replace(/^\d+\.\s*/, '').trim())
      textParts.push(items.map((item, i) => `${i + 1}. ${inlineToText(item)}`).join('\n'))
      htmlParts.push(`<ol style="font-size:15px;line-height:1.6;padding-left:20px">${items.map((item) => `<li style="margin-bottom:8px">${inlineToHtml(item)}</li>`).join('')}</ol>`)
      continue
    }

    textParts.push(lines.map(inlineToText).join('\n'))
    htmlParts.push(`<p style="font-size:15px;line-height:1.6">${lines.map(inlineToHtml).join('<br/>')}</p>`)
  }

  return { text: textParts.join('\n\n'), html: htmlParts.join('\n    ') }
}
