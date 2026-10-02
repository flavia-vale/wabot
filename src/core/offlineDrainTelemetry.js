// Medida da fila offline do WhatsApp por conexão (E11 do diagnóstico de
// travamento de filas). O Baileys drena os nodes `offline` num processador
// SERIAL e sem timeout; um node pendurado para o dreno e a sessão fica
// "conectada" sem confirmar nada. Até aqui não havia como responder "a fila
// offline está presa?" — o worker nem lia `receivedPendingNotifications`.
//
// Quando o servidor avisa que terminou de mandar a fila (`CB:ib,,offline`,
// com a contagem — exposta pelo patch do Baileys como `wabotOfflineCount`), o
// worker loga quantas mensagens o Baileys já entregou (upsert `append`) e
// repete a foto alguns minutos depois. `append` parado e `offlineCount` alto =
// dreno preso. A contagem do servidor inclui recibos/notificações, então
// `maxPending` é teto, não exato. Puro.

export function createConnectionIntake(now = Date.now()) {
  return { openedAt: now, notify: 0, append: 0, accepted: 0 }
}

export function noteUpsert(intake, type, count) {
  if (!intake || (type !== 'notify' && type !== 'append')) return intake
  return { ...intake, [type]: intake[type] + Math.max(0, Number(count) || 0) }
}

export function noteAccepted(intake) {
  return intake ? { ...intake, accepted: intake.accepted + 1 } : intake
}

export function describeOfflineDrain({ intake, offlineCount, now = Date.now(), phase }) {
  const count = Number.isFinite(Number(offlineCount)) && offlineCount !== null && offlineCount !== undefined ? Number(offlineCount) : null
  const append = intake ? intake.append : null
  return {
    phase,
    offlineCount: count,
    appendUpserts: append,
    notifyUpserts: intake ? intake.notify : null,
    acceptedSinceOpen: intake ? intake.accepted : null,
    sinceOpenMs: intake ? now - intake.openedAt : null,
    maxPending: count != null && append != null ? Math.max(0, count - append) : null,
  }
}
