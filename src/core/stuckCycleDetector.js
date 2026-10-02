// Detector do ciclo "queda 500 com mensagem travada, id DIFERENTE a cada vez"
// (Camada B da defesa genérica — docs/rca/whatsapp-sessao.md "Ciclo de
// mensagem travada"). A quarentena por id (registerStuckMessageAndDecide) só
// age quando o MESMO id volta; foi por esse buraco que as DMs indecifráveis do
// PR #2112 derrubaram contas por 7 dias (id novo a cada queda). Aqui contamos
// quedas com stuckMsg por SESSÃO, zeradas por mensagem aceita.
//
// Só sinal: nenhuma ação automática nesta versão. Puro e imutável.
import { chatKindOfJid } from './stuckAckClassifier.js'

// state = [{ at, id }] das quedas com stuckMsg desde a última mensagem aceita.
export function registerStuckDrop(state, { now, msgId, windowMs, threshold }) {
  const recent = (Array.isArray(state) ? state : []).filter((d) => now - d.at <= windowMs)
  recent.push({ at: now, id: msgId || null })
  const distinctIds = new Set(recent.map((d) => d.id).filter(Boolean)).size
  const cycle = threshold > 0 && recent.length >= threshold && distinctIds >= 2
  // Disparou: zera para não repetir o sinal a cada queda seguinte — o próximo
  // sinal exige mais `threshold` quedas.
  return { state: cycle ? [] : recent, cycle, count: recent.length, distinctIds }
}

// Falhas de decrypt por jid numa janela curta — o "culpado provável" da queda.
// Map jid -> number[] (timestamps). Limitado a `maxJids` (descarta o mais velho).
export function noteDecryptFailure(map, jid, now, { windowMs, maxJids = 200 }) {
  const next = new Map()
  for (const [j, ts] of map instanceof Map ? map : []) {
    const keep = ts.filter((t) => now - t <= windowMs)
    if (keep.length) next.set(j, keep)
  }
  if (jid) next.set(jid, [...(next.get(jid) || []), now])
  while (next.size > maxJids) next.delete(next.keys().next().value)
  return next
}

export function topDecryptCulprit(map, now, { windowMs }) {
  let best = null
  for (const [jid, ts] of map instanceof Map ? map : []) {
    const count = ts.filter((t) => now - t <= windowMs).length
    if (count && (!best || count > best.count)) best = { jid, count }
  }
  return best ? { ...best, kind: chatKindOfJid(best.jid) } : null
}

// Culpado do ciclo: o jid do próprio ack (quando o servidor manda) vence; senão
// o jid com mais falhas de decrypt nos minutos anteriores à queda.
export function describeStuckCulprit(ack, decryptMap, now, { windowMs }) {
  if (ack?.ackClass === 'status') return { jid: 'status@broadcast', kind: 'status', source: 'ack' }
  if (ack?.jid) return { jid: ack.jid, kind: chatKindOfJid(ack.jid), source: 'ack' }
  const top = topDecryptCulprit(decryptMap, now, { windowMs })
  return top ? { jid: top.jid, kind: top.kind, decryptFailures: top.count, source: 'decrypt' } : { jid: null, kind: 'desconhecido', source: null }
}
