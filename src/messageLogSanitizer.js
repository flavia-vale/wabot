// Módulo leaf (sem imports pesados) que hospeda a sanitização de texto usada
// antes de gravar em `MessageLog`. Extraído de `src/bot-worker.js` para ser
// importável em `node:test` (bot-worker.js não é importável: conecta ao
// WhatsApp e faz `import 'dotenv/config'` no load).
//
// Ver specs/006-worker-crash-log-safety/research.md (D1-D4) para o racional
// de cada decisão abaixo.

const MESSAGE_LOG_MAX_CHARS = Math.max(40, Number(process.env.MESSAGE_LOG_MAX_CHARS || 240))

// Caracteres de controle C0 (0x00-0x1F, incluindo NUL), DEL (0x7F) e
// controle C1 (0x80-0x9F).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = new RegExp('[\\x00-\\x1F\\x7F-\\x9F]', 'g')

// Casa surrogate ALTO não seguido de um BAIXO válido, ou surrogate BAIXO não
// precedido de um ALTO válido — ou seja, só os "soltos" (quebrados), nunca os
// dois lados de um par válido (que formam 1 code point, ex. emoji).
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

function sanitizeMessageForLog(text) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''

  const withoutControl = raw.replace(CONTROL_CHARS_RE, '')
  if (!withoutControl) return ''

  // Iterar por code point (não por code unit UTF-16) evita partir um par
  // surrogate de emoji ao meio — a causa raiz do `unexpected end of hex
  // escape` do Prisma quando o corte caía exatamente no meio de um par.
  const codePoints = Array.from(withoutControl)
  const truncated = codePoints.length > MESSAGE_LOG_MAX_CHARS

  const sliced = (truncated ? codePoints.slice(0, MESSAGE_LOG_MAX_CHARS) : codePoints).join('')

  // Cinto e suspensório: remove qualquer surrogate solto residual que possa
  // ter chegado já quebrado na entrada (fora do controle da truncagem acima).
  const cleaned = sliced.replace(LONE_SURROGATE_RE, '')

  return truncated ? `${cleaned}…` : cleaned
}

export { sanitizeMessageForLog, MESSAGE_LOG_MAX_CHARS }
