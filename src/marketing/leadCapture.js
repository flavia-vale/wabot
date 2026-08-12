// Captura de lead das ferramentas gratuitas (calculadoras + diagnóstico).
//
// Por que este módulo existe: até 2026-08 as ferramentas gratuitas mostravam o
// resultado na tela e a pessoa ia embora sem deixar rastro — não havia lista.
// Com ~16 visitas/mês vindas da busca, jogar fora cada visita é caro demais.
//
// Módulo PURO de propósito (não importa `db.js` nem `analytics.js`): validação e
// normalização precisam ser testáveis sem banco, como o resto da base
// (`credentialHealth`, `reconnectPolicy`, `queueExpiry`).

// Fontes permitidas. Allowlist em vez de string livre para o campo não virar
// depósito de texto arbitrário vindo do público.
export const LEAD_SOURCES = Object.freeze({
  RISK_CALCULATOR: 'calculadora-risco-whatsapp',
  TIME_CALCULATOR: 'calculadora-tempo-grupos-whatsapp',
  ANTIBAN_DIAGNOSTIC: 'diagnostico-antiban-whatsapp',
})

const KNOWN_SOURCES = new Set(Object.values(LEAD_SOURCES))

// Mesma regra do LeadMagnetCard, para a validação do cliente e a do servidor não
// discordarem (pessoa passa no formulário e toma 400 sem entender o motivo).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MAX_EMAIL_LENGTH = 160
const MAX_CONTEXT_KEYS = 12
const MAX_CONTEXT_VALUE_LENGTH = 80

/** Normaliza para deduplicar: `Ana@Gmail.com ` e `ana@gmail.com` são a mesma pessoa. */
export function normalizeLeadEmail(rawEmail) {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL_LENGTH) return null
  if (!EMAIL_RE.test(email)) return null
  return email
}

export function normalizeLeadSource(rawSource) {
  const source = String(rawSource ?? '').trim()
  return KNOWN_SOURCES.has(source) ? source : null
}

/* Contexto = o resultado que a pessoa acabou de ver (faixa de risco, horas
 * economizadas). Serve para a primeira mensagem falar do caso dela em vez de
 * texto genérico.
 *
 * Só entram escalares curtos. O corpo vem do público: sem teto, alguém cola um
 * texto de 1MB por requisição e infla o SQLite. */
export function sanitizeLeadContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) return {}

  const safe = {}
  for (const [key, value] of Object.entries(rawContext)) {
    if (Object.keys(safe).length >= MAX_CONTEXT_KEYS) break
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue
    safe[key] = String(value).slice(0, MAX_CONTEXT_VALUE_LENGTH)
  }
  return safe
}

/**
 * Valida e normaliza o corpo do POST público de captura.
 *
 * Devolve `{ ok: false, error }` em vez de lançar — quem chama é uma rota
 * pública e precisa responder 400 com mensagem em linguagem leiga.
 */
export function buildLeadCapturePayload(body = {}) {
  const email = normalizeLeadEmail(body.email)
  if (!email) return { ok: false, error: 'Confira o formato do e-mail antes de continuar.' }

  const source = normalizeLeadSource(body.source)
  if (!source) return { ok: false, error: 'Origem inválida.' }

  return {
    ok: true,
    lead: {
      email,
      source,
      context: sanitizeLeadContext(body.context),
    },
  }
}
