/**
 * Filtros de segmentação para a caixa de envio de WhatsApp da aba "Contato
 * com cliente" (2026-09-24) — "conectado", "já enviou alguma vez" e "tem
 * credencial cadastrada".
 *
 * Módulo PURO: sem banco, sem rede. Quem chama (adminEmails.js) já resolveu
 * os três fatos por cliente (uma consulta em lote cada, nunca uma por
 * cliente) e só usa este módulo para normalizar a env/query e decidir o
 * match. Isso é o que garante que a PRÉVIA (quantos batem no filtro) e o
 * ENVIO EM MASSA nunca discordem sobre quem entra.
 */

export const TRI_STATE = Object.freeze(['any', 'yes', 'no'])

function normalizeTriState(value) {
  const v = String(value ?? 'any').trim().toLowerCase()
  return TRI_STATE.includes(v) ? v : 'any'
}

/** Lê os três filtros de uma query string/objeto qualquer, tolerando lixo. */
export function parseWhatsappContactFilters(query = {}) {
  return {
    connected: normalizeTriState(query.connected),
    everSent: normalizeTriState(query.everSent),
    hasCredential: normalizeTriState(query.hasCredential),
  }
}

/**
 * @param {{connected:boolean, everSentSuccess:boolean, hasCredential:boolean}} fatos
 * @param {{connected:string, everSent:string, hasCredential:string}} filtros já normalizados
 */
export function matchesWhatsappContactFilters(fatos, filtros) {
  if (filtros.connected === 'yes' && !fatos.connected) return false
  if (filtros.connected === 'no' && fatos.connected) return false
  if (filtros.everSent === 'yes' && !fatos.everSentSuccess) return false
  if (filtros.everSent === 'no' && fatos.everSentSuccess) return false
  if (filtros.hasCredential === 'yes' && !fatos.hasCredential) return false
  if (filtros.hasCredential === 'no' && fatos.hasCredential) return false
  return true
}

/**
 * Envio em massa exige conexão ativa AGORA, mesmo que o filtro `connected`
 * esteja em "any" (ela pode querer VER quem está desconectado, sem tentar
 * mandar pra eles). Nunca o contrário: mandar não pode depender de o filtro
 * de conexão estar marcado.
 */
export function isEligibleForBulkSend(fatos) {
  return Boolean(fatos?.connected)
}
