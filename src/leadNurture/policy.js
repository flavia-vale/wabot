// Regras puras de elegibilidade e idempotência da trilha de nutrição de leads.
//
// Todas as funções são puras/determinísticas: recebem `now` como parâmetro
// (nunca leem Date.now() internamente) e não fazem I/O — testáveis db-free.
// Espelha o padrão de sessionPersistencePolicy.js.

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Passos efetivamente disparados pela passada diária. O passo 0 é coberto
// pelo e-mail de boas-vindas existente no /register (D4) — não é
// responsabilidade de computeDueSteps.
const SWEEP_STEPS = [2, 5, 7]

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Um e-mail é "real" quando tem formato válido e não é o fallback interno
 * `user_*@sistema.com` usado para contas sem e-mail informado.
 * @param {string} email
 * @returns {boolean}
 */
export function isRealEmail(email) {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase().endsWith('@sistema.com')) return false
  return EMAIL_FORMAT_RE.test(trimmed)
}

/**
 * Dias inteiros decorridos entre createdAt e now (floor).
 * @param {Date} createdAt
 * @param {Date} now
 * @returns {number}
 */
export function elapsedDays(createdAt, now) {
  const diffMs = new Date(now).getTime() - new Date(createdAt).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0
  return Math.floor(diffMs / MS_PER_DAY)
}

/**
 * Um lead está na janela ativa da trilha quando createdAt está dentro dos
 * últimos `maxDays` dias (com margem para não perder passadas atrasadas).
 * @param {Date} createdAt
 * @param {Date} now
 * @param {{ maxDays?: number }} [opts]
 * @returns {boolean}
 */
export function isWithinActiveWindow(createdAt, now, { maxDays = 8 } = {}) {
  const days = elapsedDays(createdAt, now)
  return days >= 0 && days <= maxDays
}

/**
 * Passos devidos AGORA para um lead, dado o histórico de passos já enviados
 * e o status de opt-out. Base da idempotência (FR-006) e da recuperação de
 * passada perdida (FR-011): decide por tempo decorrido, não por "hoje é o dia N".
 * @param {{ createdAt: Date, now: Date, sentSteps: Iterable<number>, isUnsubscribed: boolean }} params
 * @returns {number[]}
 */
export function computeDueSteps({ createdAt, now, sentSteps = [], isUnsubscribed = false }) {
  if (isUnsubscribed) return []
  const sent = new Set(sentSteps)
  const days = elapsedDays(createdAt, now)
  return SWEEP_STEPS.filter((step) => days >= step && !sent.has(step))
}
