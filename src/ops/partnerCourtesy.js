// Cortesia de parceiro influenciador (parceria "robô grátis + 30% recorrente").
//
// Por que este módulo existe: liberar o robô de graça para um parceiro usa a
// MESMA rota de ajuste manual de acesso que o CS usa para tudo (estender trial,
// compensar cliente, corrigir cobrança). Sem um formato padronizado no `reason`,
// não há como auditar depois QUANTAS cortesias de parceria estão de pé nem a
// quem elas pertencem — o campo vira texto livre e a informação se perde.
//
// O plano da campanha (docs/marketing/PARCERIA_INFLUENCIADORES_AFILIADOS_2026-08-04.md)
// depende dessa auditoria: a cortesia é renovável por 90 dias condicionada a
// indicados ativos, e cada cortesia é uma sessão WhatsApp a mais em produção
// (~0,35 GB — política de memória do AGENTS.md). Precisamos conseguir contar.
//
// Módulo PURO de propósito: sem import de db/analytics, para poder ser testado
// sem banco (mesma regra dos demais módulos de `src/ops/`).

export const PARTNER_COURTESY_REASON_PREFIX = 'parceiro-influenciador'

const PARTNER_CODE_MAX_LENGTH = 32
const PARTNER_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

/**
 * Normaliza o código do parceiro (o `AffiliateProfile.code` dele).
 * Devolve `''` quando o valor não serve — quem chama decide se isso é erro.
 */
export function normalizePartnerCode(code) {
  const raw = String(code ?? '').trim()
  if (!raw) return ''
  if (raw.length > PARTNER_CODE_MAX_LENGTH) return ''
  if (!PARTNER_CODE_RE.test(raw)) return ''
  return raw.toLowerCase()
}

/**
 * Monta o `reason` canônico da cortesia: `parceiro-influenciador:<codigo>`,
 * seguido do motivo escrito pelo admin (que continua obrigatório).
 *
 * Idempotente: um `reason` que já começa com o prefixo do MESMO código não é
 * prefixado de novo (evita `parceiro-influenciador:x — parceiro-influenciador:x — ...`
 * quando a cortesia é renovada a partir do texto anterior).
 */
export function buildPartnerCourtesyReason(code, reason = '') {
  const normalized = normalizePartnerCode(code)
  if (!normalized) return String(reason ?? '').trim()

  const tag = `${PARTNER_COURTESY_REASON_PREFIX}:${normalized}`
  const note = String(reason ?? '').trim()
  if (!note) return tag
  if (parsePartnerCourtesyCode(note) === normalized) return note
  return `${tag} — ${note}`
}

/**
 * Extrai o código do parceiro de um `reason` já gravado. Devolve `''` quando o
 * `reason` não é de cortesia de parceria (texto livre normal do CS).
 */
export function parsePartnerCourtesyCode(reason) {
  const raw = String(reason ?? '').trim()
  if (!raw.toLowerCase().startsWith(`${PARTNER_COURTESY_REASON_PREFIX}:`)) return ''
  const afterPrefix = raw.slice(PARTNER_COURTESY_REASON_PREFIX.length + 1)
  // Separa só por espaço: o separador do sufixo é ' — ' (com espaços), e o
  // próprio código pode conter '-' (PARTNER_CODE_RE aceita).
  const token = afterPrefix.split(/\s/, 1)[0] ?? ''
  return normalizePartnerCode(token)
}

export function isPartnerCourtesyReason(reason) {
  return parsePartnerCourtesyCode(reason) !== ''
}
