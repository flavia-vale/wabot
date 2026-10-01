/**
 * Mede se um servidor secundário (outro endereço de internet) deixa o WhatsApp
 * mais instável que o principal (MN-20, risco K9). PURO: recebe eventos de
 * conexão já lidos do banco e devolve resumo + veredito em linguagem leiga.
 *
 * Honestidade estatística: com UMA conta-teste isto só detecta problema GROSSEIRO
 * (queda em loop, QR novo, bloqueio). "Sem diferença" NÃO prova que é seguro
 * mover muitas contas — só que, nessa janela, nada gritante apareceu.
 */

import { DEFAULT_NODE_ID, isValidNodeId } from './protocol.js'

/** Eventos que indicam instabilidade real (reconnect_attempt é contado à parte). */
export const BAD_EVENT_TYPES = Object.freeze(['forbidden', 'replaced', 'auth_reset', 'flap_cooldown', 'stable_close_cooldown', 'retry_giveup'])
/** Códigos de desconexão do WhatsApp que importam para o assunto de IP. */
export const WATCHED_CODES = Object.freeze(['405', '408', '428', '440', '500'])

export const MIN_WINDOW_HOURS = 72
export const WORSE_RATIO = 2
export const WORSE_MIN_EVENTS = 3

const nodeOf = (userId, nodeOfUser) => {
  const id = nodeOfUser?.[userId]
  return isValidNodeId(id) ? id : DEFAULT_NODE_ID // nulo = n1
}

/**
 * @param {Object} m
 * @param {Array<{userId:string, type:string, code?:string|null}>} m.events
 * @param {Record<string, string|null>} m.nodeOfUser   userId -> nodeId (nulo = n1)
 * @param {number} m.windowHours
 * @returns {Record<string, {accounts:number, bad:number, reconnects:number, accountDays:number, badPerAccountDay:number|null, byType:Object, byCode:Object}>}
 */
export function summarizeInstabilityByNode({ events = [], nodeOfUser = {}, windowHours } = {}) {
  const days = Number(windowHours) / 24
  const perNode = {}
  const ensure = id => (perNode[id] ??= { accounts: 0, bad: 0, reconnects: 0, byType: {}, byCode: {} })

  for (const userId of Object.keys(nodeOfUser)) ensure(nodeOf(userId, nodeOfUser)).accounts++
  for (const e of events) {
    if (!(e?.userId in nodeOfUser)) continue // conta fora do conjunto medido
    const n = ensure(nodeOf(e.userId, nodeOfUser))
    if (e.type === 'reconnect_attempt') { n.reconnects++; continue }
    if (!BAD_EVENT_TYPES.includes(e.type)) continue
    n.bad++
    n.byType[e.type] = (n.byType[e.type] ?? 0) + 1
    const code = String(e.code ?? '')
    if (WATCHED_CODES.includes(code)) n.byCode[code] = (n.byCode[code] ?? 0) + 1
  }
  for (const n of Object.values(perNode)) {
    n.accountDays = n.accounts * days
    n.badPerAccountDay = n.accountDays > 0 ? n.bad / n.accountDays : null
  }
  return perNode
}

/**
 * Compara o candidato (ex.: n2) com a base (n1).
 * @returns {{code:'insufficient_data'|'worse'|'no_difference', message:string, ratio:number|null}}
 */
export function compareNodes({ summary, base = DEFAULT_NODE_ID, candidate, windowHours } = {}) {
  const b = summary?.[base]
  const c = summary?.[candidate]
  if (!c || !(c.accounts >= 1)) {
    return { code: 'insufficient_data', ratio: null, message: `Nenhuma conta está no servidor "${candidate}": não há o que medir.` }
  }
  if (!(Number(windowHours) >= MIN_WINDOW_HOURS)) {
    return { code: 'insufficient_data', ratio: null, message: `A janela é curta demais (${windowHours} h; o mínimo é ${MIN_WINDOW_HOURS} h). Espere mais antes de concluir.` }
  }
  if (!b || !(b.accounts >= 1) || b.badPerAccountDay === null) {
    return { code: 'insufficient_data', ratio: null, message: `Não há contas suficientes no servidor "${base}" para servir de comparação.` }
  }

  const cRate = c.badPerAccountDay
  const bRate = b.badPerAccountDay
  const ratio = bRate > 0 ? cRate / bRate : (cRate > 0 ? Infinity : 1)
  const sensitive = (c.byType.auth_reset ?? 0) + (c.byType.forbidden ?? 0) // pedir QR novo / bloqueio
  const sensitiveBase = (b.byType.auth_reset ?? 0) + (b.byType.forbidden ?? 0)

  if (sensitive > 0 && sensitiveBase === 0) {
    return { code: 'worse', ratio, message: `No servidor "${candidate}" apareceram ${sensitive} caso(s) de QR novo/bloqueio que NÃO aparecem no "${base}". Pare de mover contas e investigue o endereço de internet desse servidor.` }
  }
  if (c.bad >= WORSE_MIN_EVENTS && ratio >= WORSE_RATIO) {
    return { code: 'worse', ratio, message: `As contas do servidor "${candidate}" tiveram ${c.bad} eventos de instabilidade, cerca de ${Number.isFinite(ratio) ? ratio.toFixed(1) : 'muito'} vezes mais por conta e por dia que no "${base}". Não mova mais contas até entender o motivo.` }
  }
  return { code: 'no_difference', ratio, message: `Nada gritante no servidor "${candidate}" nesta janela (${c.bad} eventos de instabilidade em ${c.accounts} conta(s)). Isto NÃO prova que é seguro mover muitas contas: com poucas contas só aparece problema grosseiro. Aumente aos poucos.` }
}
