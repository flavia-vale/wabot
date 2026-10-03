// Chave do robô de WhatsApp (vários números por conta — docs/rca/multi-numero.md).
//
// O número 1 usa a PRÓPRIA conta como chave (`userId`), exatamente como antes:
// pasta de login, Map de robôs, chaves no Redis e dedup do principal não mudam
// de nome, então nenhuma sessão existente é migrada. Números extras usam
// `<userId>~n<slot>`. Proibido montar ou cortar `~n` fora deste arquivo.

export const PRIMARY_SLOT = 1
// Fase 1: só um número reserva. Subir este teto é decisão de produto (Fase 3).
export const MAX_SLOT = 2
const SEPARATOR = '~n'
const EXTRA_KEY = /^(.+)~n(\d+)$/

function assertUserId(userId) {
  const id = String(userId ?? '')
  if (!id || id.includes(SEPARATOR) || /[/\\\s]/.test(id)) throw new Error(`userId inválido para chave de sessão: ${JSON.stringify(userId)}`)
  return id
}

function assertSlot(slot) {
  const n = Number(slot)
  if (!Number.isInteger(n) || n < PRIMARY_SLOT || n > MAX_SLOT) throw new Error(`slot inválido: ${JSON.stringify(slot)}`)
  return n
}

export function buildSessionKey(userId, slot = PRIMARY_SLOT) {
  const id = assertUserId(userId)
  const n = assertSlot(slot)
  return n === PRIMARY_SLOT ? id : `${id}${SEPARATOR}${n}`
}

// Devolve { userId, slot } ou null para chave malformada (nunca lança: chave
// vem de env, Redis e mensagens entre processos).
export function parseSessionKey(key) {
  const raw = String(key ?? '')
  if (!raw || /[/\\\s]/.test(raw)) return null
  const match = raw.match(EXTRA_KEY)
  if (!match) return raw.includes(SEPARATOR) ? null : { userId: raw, slot: PRIMARY_SLOT }
  const slot = Number(match[2])
  if (!Number.isInteger(slot) || slot <= PRIMARY_SLOT || slot > MAX_SLOT || match[1].includes(SEPARATOR)) return null
  return { userId: match[1], slot }
}

export function accountIdFromSessionKey(key) {
  return parseSessionKey(key)?.userId ?? null
}

export function isExtraSessionKey(key) {
  const parsed = parseSessionKey(key)
  return Boolean(parsed && parsed.slot !== PRIMARY_SLOT)
}

// Papel do robô: o número ativo da conta envia e escuta; os demais ficam de
// prontidão. Conta sem `activeWaSlot` válido = número 1 ativo (como sempre).
export function roleForSlot({ slot, activeWaSlot } = {}) {
  const active = Number.isInteger(activeWaSlot) && activeWaSlot >= PRIMARY_SLOT ? activeWaSlot : PRIMARY_SLOT
  return Number(slot) === active ? 'active' : 'standby'
}
