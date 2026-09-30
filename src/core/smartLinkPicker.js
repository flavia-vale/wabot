// Regras puras do Link Inteligente (rodízio de convites). Sem banco, sem relógio.
//
// Escolha: o grupo elegível com MENOS membros. Membros = última amostra horária
// (GroupMemberSample) + "reserva" (cliques desde essa amostra) — sem a reserva,
// uma rajada de cliques cairia toda no mesmo grupo até a próxima amostra.
// Diferença pequena (<= NEAR_TIE_MEMBERS) conta como empate e alterna entre os
// grupos (o menos recentemente escolhido vai primeiro).

export const DEFAULT_CAP_PER_GROUP = 1000
export const MIN_CAP_PER_GROUP = 50
// Limite do WhatsApp por grupo (a confirmar em produção; ver docs/rca/grupos-membros.md).
export const MAX_CAP_PER_GROUP = 1024
export const NEAR_TIE_MEMBERS = 5

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
// Endereços que já significam outra coisa no site.
const RESERVED_SLUGS = new Set(['api', 'painel', 'admin', 'login', 'g', 'r', 'cadastro', 'suporte', 'www'])
const INVITE_CODE_RE = /^[A-Za-z0-9]{10,40}$/

/** Slug do link público: minúsculas, números e hífen; 3 a 40 caracteres. */
export function normalizeSlug(raw) {
  const slug = String(raw ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '-')
  if (!SLUG_RE.test(slug) || slug.includes('--') || RESERVED_SLUGS.has(slug)) return null
  return slug
}

/** Só aceita o que parece código de convite; o redirect nunca sai de chat.whatsapp.com. */
export function isValidInviteCode(code) {
  return typeof code === 'string' && INVITE_CODE_RE.test(code)
}

export function inviteUrl(code) {
  return isValidInviteCode(code) ? `https://chat.whatsapp.com/${code}` : null
}

export function normalizeCap(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < MIN_CAP_PER_GROUP || n > MAX_CAP_PER_GROUP) return null
  return n
}

/**
 * @param {Array<{id:string, enabled:boolean, inviteCode:string|null, size:number|null, reserved:number, lastPickedAt:number}>} candidates
 * @param {{cap?:number}} [opts]
 * @returns {{ group: object|null, reason: 'ok'|'empty'|'all_full' }}
 */
export function pickGroup(candidates, { cap = DEFAULT_CAP_PER_GROUP } = {}) {
  const usable = (candidates ?? []).filter(c => c.enabled && isValidInviteCode(c.inviteCode))
  if (usable.length === 0) return { group: null, reason: 'empty' }

  const oldestPickedFirst = (a, b) => (a.lastPickedAt ?? 0) - (b.lastPickedAt ?? 0) || String(a.id).localeCompare(String(b.id))

  const known = usable
    .filter(c => Number.isInteger(c.size))
    .map(c => ({ c, effective: c.size + (c.reserved ?? 0) }))
    .filter(x => x.effective < cap)
  if (known.length > 0) {
    const min = Math.min(...known.map(x => x.effective))
    const near = known.filter(x => x.effective <= min + NEAR_TIE_MEMBERS).map(x => x.c)
    return { group: near.sort(oldestPickedFirst)[0], reason: 'ok' }
  }

  // Sem amostra ainda (grupo recém-adicionado): só entra se não há grupo medido
  // com vaga. Conta a reserva para não lotar às cegas.
  const unknown = usable.filter(c => !Number.isInteger(c.size) && (c.reserved ?? 0) < cap)
  if (unknown.length > 0) return { group: unknown.sort(oldestPickedFirst)[0], reason: 'ok' }

  return { group: null, reason: 'all_full' }
}

/**
 * Reserva em memória: +1 por clique humano desde a última amostra do grupo.
 * Quando entra amostra nova (sampledAt muda) a contagem real já reflete os
 * cliques e a reserva zera. Reiniciar a API zera a reserva (até 1 h de folga).
 */
export function createReserveTracker() {
  const byGroup = new Map()
  return {
    get(groupId, sampledAtMs) {
      const e = byGroup.get(groupId)
      return e && e.since === (sampledAtMs ?? 0) ? e.n : 0
    },
    add(groupId, sampledAtMs) {
      const since = sampledAtMs ?? 0
      const e = byGroup.get(groupId)
      if (e && e.since === since) e.n += 1
      else byGroup.set(groupId, { since, n: 1 })
    },
  }
}
