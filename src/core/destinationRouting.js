// Decide PARA ONDE uma mensagem espelhada vai — módulo puro, consumido pelo
// bot-worker no momento em que a mensagem chega e de novo no dequeue.
//
// RCA 2026-08-26 (cliente julianepumuceno16@gmail.com — "está mandando em outro
// grupo que nem está selecionado"):
//
// A regra histórica era `targetPostJids.length ? targetPostJids : todos os
// destinos`. "Sem vínculo" significava "manda para TODO MUNDO". Só que os
// vínculos (`GroupTarget`) têm `onDelete: Cascade` no destino: apagar um grupo
// de destino apaga silenciosamente as linhas de vínculo que apontavam para ele.
// Uma origem que a cliente havia amarrado explicitamente a N destinos, ao ficar
// com zero vínculos por causa dessas exclusões, DEIXAVA DE SER EXPLÍCITA e
// passava a espelhar para todos os destinos da conta — inclusive grupos que ela
// nunca selecionou para aquela origem. Nada no painel nem no log avisava.
//
// `Group.targetsMode` guarda a intenção da cliente ('explicit' quando ela
// escolheu destinos pelo painel; 'all' = comportamento histórico de quem nunca
// escolheu). Com 'explicit', lista vazia significa "nenhum destino" — nunca
// "todos". Melhor não enviar do que enviar para grupo errado: o envio errado é
// irreversível e queima a credibilidade da cliente com o público dela.

export const TARGETS_MODE = {
  ALL: 'all',
  EXPLICIT: 'explicit',
}

export const DESTINATION_REASON = {
  EXPLICIT: 'explicit',
  EXPLICIT_EMPTY: 'explicit_empty',
  FALLBACK_ALL: 'fallback_all',
}

function cleanJids(list) {
  if (!Array.isArray(list)) return []
  return list.filter(jid => typeof jid === 'string' && jid.length > 0)
}

/**
 * @returns {{ destinations: string[], reason: string }}
 */
export function resolveMonitorDestinations({ targetsMode, targetPostJids, allPostJids } = {}) {
  const explicit = cleanJids(targetPostJids)
  if (targetsMode === TARGETS_MODE.EXPLICIT) {
    return {
      destinations: explicit,
      reason: explicit.length ? DESTINATION_REASON.EXPLICIT : DESTINATION_REASON.EXPLICIT_EMPTY,
    }
  }
  if (explicit.length) return { destinations: explicit, reason: DESTINATION_REASON.EXPLICIT }
  return { destinations: cleanJids(allPostJids), reason: DESTINATION_REASON.FALLBACK_ALL }
}

/**
 * Revalidação no DEQUEUE. Os destinos de um envio são calculados quando a
 * mensagem chega, mas o job pode ficar minutos/horas na fila (preservação do
 * destino, freio de fila). Se a cliente desvincular ou apagar o destino nesse
 * meio-tempo, a alteração vale para mensagens futuras e NÃO cancelava o job já
 * materializado — foi assim que um envio saiu 1,5s DEPOIS de a cliente apagar o
 * destino no painel (mesmo RCA acima).
 *
 * Fail-safe: sem uma foto confiável da config atual (`known:false`) o envio
 * segue. Descartar por dúvida perderia oferta legítima; o caso que estamos
 * fechando é o oposto — enviar para destino que já não está mais na lista.
 */
export function shouldDropUnlinkedDestination({ destJid, currentDestinations, known = true } = {}) {
  if (!known) return { drop: false, reason: 'unknown_config' }
  if (!destJid) return { drop: false, reason: 'no_dest' }
  const destinations = cleanJids(currentDestinations)
  if (destinations.includes(destJid)) return { drop: false, reason: 'still_linked' }
  return { drop: true, reason: 'dest_unlinked' }
}
