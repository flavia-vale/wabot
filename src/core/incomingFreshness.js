// Módulo puro (sem io/db): decide se uma mensagem que chegou em
// `messages.upsert` deve ENTRAR no pipeline de espelhamento.
//
// RCA 2026-07 (mensagem publicada 1x no grupo monitorado e espelhada 5x ao
// longo de ~6h): a mensagem estava sendo VISTA várias vezes, não enviada várias
// vezes por engano. Confirmado na fonte do Baileys 6.7.23
// (`lib/Socket/messages-recv.js`):
//
//   await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify')
//
// Ou seja: mensagem REENTREGUE pelo WhatsApp (fila offline, drenada a cada
// reconexão) chega com `type: 'append'`; mensagem ao vivo chega como
// `'notify'`. O handler aceitava os dois tipos, e a única barreira contra a
// reentrega era o cutoff de idade — que o Baileys monta com
// `messageTimestamp: +stanza.attrs.t` (`lib/Utils/decode-wa-message.js`). Sem
// o atributo `t` no stanza isso vira `NaN`, o cutoff era PULADO (o código lia
// `if (msgTs && msgTs < cutoff)`) e a reentrega passava direto — inclusive de
// mensagem de horas antes.
//
// Regra: cada mensagem é vista UMA vez, ao vivo. Reentrega não reentra.
// - `append` (reentrega/histórico) sem timestamp confiável -> DESCARTA. Não dá
//   para provar que é nova, e a via de entrega já diz que não é ao vivo.
// - Qualquer tipo com timestamp mais velho que `maxAgeMs` -> DESCARTA.
// - `notify` (ao vivo) sem timestamp -> PROCESSA. É o caminho da mensagem nova;
//   descartar aqui perderia mensagem legítima quando o stanza vem sem `t`.
//
// Nota: `append` também é o tipo de mensagem de CANAL (@newsletter) ao vivo
// (`Processed plaintext newsletter message`, mesmo arquivo do Baileys) — por
// isso NÃO dá para descartar `append` em bloco. Essas chegam com `t` válido e
// recente, então passam normalmente pela regra de idade.

export const INCOMING_MAX_AGE_MS = 5 * 60_000

// RCA 2026-09-24 (frota): as sessões caem com 500 ~1×/hora por conta, e as
// mensagens publicadas DURANTE a queda chegam 27–58 min depois — e eram
// jogadas fora por este mesmo portão (196 descartes de 10–60 min em 60 MB de
// log, 47 robôs; numa conta, 35 de 87 mensagens dos grupos monitorados).
// Decisão da dona do produto: mensagem de ORIGEM MONITORADA com até
// INCOMING_LATE_MAX_AGE_MS passa, desde que o id NUNCA tenha sido visto (o
// conjunto de ids vistos fica em disco, no arquivo da dedup, com janela maior
// que esta — ver seenIncomingIdWindowMs no bot-worker). Reentrega do mesmo
// id continua descartada; `append` sem timestamp continua descartada; acima da
// janela tardia continua descartada. A dedup de link no envio segue como
// segunda rede. NÃO esticar DEDUP_MSGID_WINDOW_MS nem amarrar
// linkDedupWindowMs para "compensar" — ver o não-regredir do RCA 2026-07.
export const INCOMING_LATE_MAX_AGE_MS = 60 * 60_000

export const INCOMING_DROP_REASON = Object.freeze({
  STALE: 'stale',
  // Atrasada dentro da janela tardia, mas o id JÁ tinha sido visto: é reentrega.
  STALE_REPLAY: 'stale_replay',
  REPLAY_WITHOUT_TIMESTAMP: 'replay_without_timestamp',
})

export const INCOMING_ACCEPT_REASON = Object.freeze({
  LATE_MONITORED_SOURCE: 'late_monitored_source',
})

/**
 * @param {object} params
 * @param {string} params.upsertType       'notify' (ao vivo) | 'append' (reentrega/histórico)
 * @param {number|null} params.messageTimestampMs  timestamp da mensagem em ms (null = ausente/inválido)
 * @param {number} [params.now]
 * @param {number} [params.maxAgeMs]
 * @param {number} [params.lateMaxAgeMs]   janela tardia para origem monitorada (0 desliga)
 * @param {boolean} [params.isMonitoredSource]  a mensagem veio de uma origem monitorada
 * @param {boolean} [params.seenBefore]    o id já foi visto neste robô (reentrega)
 * @returns {{ process: boolean, reason: string|null, ageMs: number|null, late?: boolean }}
 */
export function shouldProcessIncomingMessage({
  upsertType,
  messageTimestampMs,
  now = Date.now(),
  maxAgeMs = INCOMING_MAX_AGE_MS,
  lateMaxAgeMs = 0,
  isMonitoredSource = false,
  seenBefore = false,
} = {}) {
  const ts = Number(messageTimestampMs)
  const hasTimestamp = Number.isFinite(ts) && ts > 0
  const ageMs = hasTimestamp ? now - ts : null

  if (hasTimestamp && ageMs >= maxAgeMs) {
    const lateWindow = Number(lateMaxAgeMs)
    const withinLateWindow = Number.isFinite(lateWindow) && lateWindow > maxAgeMs && ageMs < lateWindow
    if (withinLateWindow && isMonitoredSource === true) {
      if (seenBefore === true) return { process: false, reason: INCOMING_DROP_REASON.STALE_REPLAY, ageMs }
      return { process: true, reason: INCOMING_ACCEPT_REASON.LATE_MONITORED_SOURCE, ageMs, late: true }
    }
    return { process: false, reason: INCOMING_DROP_REASON.STALE, ageMs }
  }
  if (!hasTimestamp && upsertType === 'append') {
    return { process: false, reason: INCOMING_DROP_REASON.REPLAY_WITHOUT_TIMESTAMP, ageMs: null }
  }
  return { process: true, reason: null, ageMs }
}
