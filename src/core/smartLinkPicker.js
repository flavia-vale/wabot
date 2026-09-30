// Regras puras do Link Inteligente (rodízio de convites). Sem banco, sem relógio.
//
// Escolha: o grupo com MENOS membros ATUAIS (última medição), trocando para outro
// grupo ao chegar na margem de 95% da capacidade. Cliques não mandam no
// rodízio: só entram como freio interno contra estouro entre duas medições
// (ver `pickGroup`). Diferença pequena (<= NEAR_TIE_MEMBERS) conta como empate e
// alterna entre os grupos (o menos recentemente escolhido vai primeiro).

import { ROTATION_MARGIN_PCT } from './smartLinkOccupancy.js'

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

/** Membros a partir dos quais o grupo entra na "reserva" (95% da capacidade). */
export function marginMembers(cap, marginPct = ROTATION_MARGIN_PCT) {
  return Math.floor((cap * marginPct) / 100)
}

/**
 * Escolhe para qual grupo mandar o próximo clique.
 *
 * O RANKING usa os membros atuais medidos (o grupo com menos gente vai primeiro).
 * Os cliques recentes (`reserved`) NÃO mexem no ranking: só entram como freio na
 * checagem de limite, para um grupo não estourar entre duas medições.
 *
 *  1. Grupos medidos abaixo da MARGEM (95% da capacidade): o de menos membros;
 *     diferença de até 5 membros é empate e alterna pelo menos recente.
 *  2. Grupo sem medição (recém-adicionado): só se nenhum medido tem vaga.
 *  3. "Reserva": todos já passaram da margem mas ainda não lotaram (< 100%):
 *     manda para o menos cheio — melhor um grupo quase cheio do que uma página
 *     morta, enquanto o WhatsApp ainda aceita gente.
 *  4. Todos em 100%: sem destino (`all_full`).
 *
 * @param {Array<{id:string, enabled:boolean, inviteCode:string|null, size:number|null, reserved:number, lastPickedAt:number}>} candidates
 * @param {{cap?:number}} [opts]
 * @returns {{ group: object|null, reason: 'ok'|'reserve'|'empty'|'all_full' }}
 */
export function pickGroup(candidates, { cap = DEFAULT_CAP_PER_GROUP } = {}) {
  const usable = (candidates ?? []).filter(c => c.enabled && isValidInviteCode(c.inviteCode))
  if (usable.length === 0) return { group: null, reason: 'empty' }

  const oldestPickedFirst = (a, b) => (a.lastPickedAt ?? 0) - (b.lastPickedAt ?? 0) || String(a.id).localeCompare(String(b.id))
  const margin = marginMembers(cap)
  const withBrake = c => c.size + (c.reserved ?? 0)
  const measured = usable.filter(c => Number.isInteger(c.size))

  const preferred = measured.filter(c => withBrake(c) < margin)
  if (preferred.length > 0) {
    const min = Math.min(...preferred.map(c => c.size))
    const near = preferred.filter(c => c.size <= min + NEAR_TIE_MEMBERS)
    return { group: near.sort(oldestPickedFirst)[0], reason: 'ok' }
  }

  // Sem medição ainda: entra só se não há grupo medido com vaga (conta a reserva).
  const unknown = usable.filter(c => !Number.isInteger(c.size) && (c.reserved ?? 0) < margin)
  if (unknown.length > 0) return { group: unknown.sort(oldestPickedFirst)[0], reason: 'ok' }

  const reserve = measured.filter(c => withBrake(c) < cap)
  if (reserve.length > 0) {
    const leastFull = [...reserve].sort((a, b) => withBrake(a) - withBrake(b) || oldestPickedFirst(a, b))[0]
    return { group: leastFull, reason: 'reserve' }
  }

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
