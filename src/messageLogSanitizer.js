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

// Corta `text` em no máximo `maxCodePoints` CODE POINTS e remove qualquer
// surrogate solto que sobre. `String.prototype.slice` conta code UNITS UTF-16,
// então cortar em 80 no meio de um emoji deixa metade de um par surrogate na
// ponta — e o motor do Prisma recusa a gravação inteira com
// `unexpected end of hex escape`. Foi assim que a reserva de `SendDedupKey`
// falhava em produção (o texto já passava por `sanitizeMessageForLog`, mas o
// `.slice(0, 80)` aplicado DEPOIS reintroduzia o surrogate solto).
// Não acrescenta reticências: isto serve para chave técnica, não para leitura.
function truncateByCodePoints(text, maxCodePoints) {
  const raw = String(text ?? '')
  const limit = Math.max(0, Number(maxCodePoints) || 0)
  const codePoints = Array.from(raw)
  const sliced = (codePoints.length > limit ? codePoints.slice(0, limit) : codePoints).join('')
  return sliced.replace(LONE_SURROGATE_RE, '')
}

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

// Texto completo para o reenvio pós-restart (MessageLog.resendText). Ao
// contrário de sanitizeMessageForLog, NÃO colapsa espaços nem quebras de linha
// nem corta em 240: é a oferta que vai sair de novo no grupo. Só tira o que o
// Prisma/SQLite recusa (NUL, surrogate solto). Acima do teto devolve null em
// vez de cortar — oferta cortada não deve ser reenviada (o reenvio pula).
const RESEND_TEXT_MAX_CHARS = 8000
// eslint-disable-next-line no-control-regex
const RESEND_UNSAFE_CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

function sanitizeResendText(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return null
  const cleaned = raw.replace(RESEND_UNSAFE_CONTROL_RE, '').replace(LONE_SURROGATE_RE, '')
  if (!cleaned.trim()) return null
  if (Array.from(cleaned).length > RESEND_TEXT_MAX_CHARS) return null
  return cleaned
}

export { sanitizeMessageForLog, sanitizeResendText, truncateByCodePoints, MESSAGE_LOG_MAX_CHARS, RESEND_TEXT_MAX_CHARS }
