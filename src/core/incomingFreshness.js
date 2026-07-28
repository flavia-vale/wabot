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

export const INCOMING_DROP_REASON = Object.freeze({
  STALE: 'stale',
  REPLAY_WITHOUT_TIMESTAMP: 'replay_without_timestamp',
})

/**
 * @param {object} params
 * @param {string} params.upsertType       'notify' (ao vivo) | 'append' (reentrega/histórico)
 * @param {number|null} params.messageTimestampMs  timestamp da mensagem em ms (null = ausente/inválido)
 * @param {number} [params.now]
 * @param {number} [params.maxAgeMs]
 * @returns {{ process: boolean, reason: string|null, ageMs: number|null }}
 */
export function shouldProcessIncomingMessage({
  upsertType,
  messageTimestampMs,
  now = Date.now(),
  maxAgeMs = INCOMING_MAX_AGE_MS,
} = {}) {
  const ts = Number(messageTimestampMs)
  const hasTimestamp = Number.isFinite(ts) && ts > 0
  const ageMs = hasTimestamp ? now - ts : null

  if (hasTimestamp && ageMs >= maxAgeMs) {
    return { process: false, reason: INCOMING_DROP_REASON.STALE, ageMs }
  }
  if (!hasTimestamp && upsertType === 'append') {
    return { process: false, reason: INCOMING_DROP_REASON.REPLAY_WITHOUT_TIMESTAMP, ageMs: null }
  }
  return { process: true, reason: null, ageMs }
}
