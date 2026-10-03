// Rodízio de envio (vários números, Fase 2 — docs/rca/multi-numero.md).
// Puro: sem banco, sem relógio próprio.
//
// Cada GRUPO tem um número DONO fixo (não alterna mensagem a mensagem): o
// grupo vê sempre o mesmo remetente e o volume por número fica previsível.
// Só é dono quem é membro do grupo e está conectado. Dono válido é mantido
// (estável entre passadas); os demais são distribuídos pelo VOLUME dos
// últimos dias, não pela contagem de grupos.

export const ROTATION_SLOTS = Object.freeze([1, 2])
// Grupo sem histórico pesa 1: sem volume, distribui pela quantidade.
const weight = d => Math.max(1, Number(d?.volume) || 0)

// destinations: [{ waJid, volume }]; memberships: { [slot]: Set<waJid> };
// connected: { [slot]: boolean }; current: Map<waJid, slot>.
// Devolve Map<waJid, slot|null> (null = nenhum número pode enviar ali).
export function assignOwners({ destinations = [], memberships = {}, connected = {}, current = new Map() } = {}) {
  const eligibleFor = jid => ROTATION_SLOTS.filter(slot => connected[slot] && memberships[slot]?.has(jid))
  const load = Object.fromEntries(ROTATION_SLOTS.map(slot => [slot, 0]))
  const owners = new Map()
  const pending = []
  for (const d of destinations) {
    const eligible = eligibleFor(d.waJid)
    const keep = current.get(d.waJid)
    if (eligible.length === 0) { owners.set(d.waJid, null); continue }
    if (eligible.includes(keep)) { owners.set(d.waJid, keep); load[keep] += weight(d); continue }
    pending.push({ ...d, eligible })
  }
  // Maiores primeiro: equilibra melhor o volume.
  pending.sort((a, b) => (Number(b.volume) || 0) - (Number(a.volume) || 0) || String(a.waJid).localeCompare(String(b.waJid)))
  for (const d of pending) {
    const slot = d.eligible.reduce((best, s) => (load[s] < load[best] ? s : best), d.eligible[0])
    owners.set(d.waJid, slot)
    load[slot] += weight(d)
  }
  return owners
}

// Quem envia ESTE job. Dono acima do teto/hora e o outro número membro e
// abaixo do teto → vai pelo outro (transbordo). Sem dono possível → quem
// chamou (o ativo) envia, como antes do rodízio.
export function pickSender({ waJid, owners, memberships = {}, connected = {}, hourlyCounts = {}, hourlyCap = Infinity, fallbackSlot }) {
  const owner = owners?.get(waJid)
  if (!owner) return fallbackSlot
  const under = slot => (Number(hourlyCounts[slot]) || 0) < hourlyCap
  if (under(owner)) return owner
  const other = ROTATION_SLOTS.find(slot => slot !== owner && connected[slot] && memberships[slot]?.has(waJid) && under(slot))
  return other ?? owner
}

export function rotationEnabledByEnv(env = process.env) {
  return String(env?.MULTI_NUMBER_ROTATION_ENABLED ?? '').trim().toLowerCase() === 'true'
}

export function senderHourlyCap(env = process.env) {
  const n = Number(env?.MULTI_NUMBER_SENDER_HOURLY_CAP)
  return Number.isFinite(n) && n > 0 ? n : Infinity
}

// Fila de envio do processo. Processo da conta mantém o nome de sempre
// (`wabot-send-<userId>`); o de prontidão/segundo remetente ganha a sua.
export function sendQueueNameFor({ processKey, isStandby = false, override = '' } = {}) {
  if (override) return isStandby ? `${override}~n2` : override
  return `wabot-send-${processKey}`
}

// Só atravessa processo o job que já é serializável e não espera retorno em
// memória (onDone). Canal (`@newsletter`) e conversa fora — só grupo.
export function isRoutableJob(job, { findUnserializableField } = {}) {
  if (!job || typeof job.onDone === 'function') return false
  if (!String(job.destJid ?? '').endsWith('@g.us')) return false
  if (typeof findUnserializableField === 'function' && findUnserializableField({ ...job, onDone: undefined })) return false
  return true
}
