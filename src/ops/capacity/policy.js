/** Capacity policy version persisted with every decision. */
export const CAPACITY_POLICY_VERSION = 'capacity-policy-v1';

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null
const integer = (value) => { const number = finite(value); return number == null ? null : Math.max(0, Math.trunc(number)) }

export function evaluateResourceHealth(input = {}) {
  const cpu = finite(input.cpuPercent)
  const disk = finite(input.diskUsedPercent)
  const inodes = finite(input.inodeUsedPercent)
  const swapIn = finite(input.swapInKbPerSec) ?? 0
  const swapOut = finite(input.swapOutKbPerSec) ?? 0
  const memoryAvailable = finite(input.memoryAvailableMb)
  const memoryTotal = finite(input.memoryTotalMb)
  const memoryAvailablePercent = memoryTotal > 0 && memoryAvailable != null ? memoryAvailable / memoryTotal * 100 : null
  const severity = (value, attention, critical) => value == null ? 'unknown' : value >= critical ? 'critical' : value >= attention ? 'attention' : 'healthy'
  const resources = {
    memory: { state: memoryAvailablePercent == null ? 'unknown' : memoryAvailablePercent < 10 ? 'critical' : memoryAvailablePercent < 20 ? 'attention' : 'healthy', availablePercent: memoryAvailablePercent },
    cpu: { state: severity(cpu, 70, 85), percent: cpu },
    disk: { state: severity(disk, 75, 90), usedPercent: disk },
    inodes: { state: severity(inodes, 75, 90), usedPercent: inodes },
    swap: { state: swapOut > 0 && memoryAvailablePercent != null && memoryAvailablePercent < 20 ? 'critical' : (swapIn > 0 || swapOut > 0) ? 'attention' : 'healthy', active: swapIn > 0 || swapOut > 0 },
  }
  const order = ['memory', 'swap', 'disk', 'inodes', 'cpu']
  const bottleneck = ['critical', 'attention'].flatMap((state) => order.filter((key) => resources[key].state === state))[0] ?? null
  return { resources, bottleneck }
}

/** Pure, conservative capacity decision. Swap is deliberately not capacity. */
export function evaluateCapacity(input = {}) {
  const memoryTotalMb = finite(input.memoryTotalMb)
  const connectedSessions = integer(input.connectedSessions)
  const productionWorkers = integer(input.productionWorkers)
  const sessions = Math.max(connectedSessions ?? 0, productionWorkers ?? 0)
  const reasons = []
  if (connectedSessions != null && productionWorkers != null && connectedSessions !== productionWorkers) reasons.push({ code: 'SESSION_WORKER_DIVERGENCE', severity: 'attention', message: 'Sessões e workers divergem; foi usado o maior contador.' })
  if (!memoryTotalMb || (connectedSessions == null && productionWorkers == null)) return { state: 'insufficient_data', sessions: connectedSessions ?? productionWorkers, safeLimit: null, estimatedMaximum: null, headroomSessions: null, headroomMemoryMb: null, bottleneck: null, recommendation: 'Aguardando uma coleta completa para calcular a capacidade.', reserveMb: null, sessionCostMb: null, policyVersion: CAPACITY_POLICY_VERSION, reasons: [...reasons, { code: 'MISSING_ESSENTIAL_DATA', severity: 'unknown', message: 'Memória total ou contagem de sessões indisponível.' }] }
  const reserveMb = Math.ceil(Math.max(memoryTotalMb * 0.2, 1536, finite(input.fixedBaseP95Mb) ?? 0))
  const observedP95 = finite(input.workerRssP95Mb)
  const p95Reliable = (finite(input.workerHistoryDays) ?? 0) >= 14 && observedP95 != null
  const sessionCostMb = Math.ceil(Math.max(350, p95Reliable ? observedP95 : 0))
  if (!p95Reliable) reasons.push({ code: 'CONSERVATIVE_SESSION_COST', severity: 'info', message: 'Usado piso conservador de 350 MB por sessão.' })
  const usableMb = Math.max(0, memoryTotalMb - reserveMb)
  const safeLimit = Math.floor(usableMb / sessionCostMb)
  const estimatedMaximum = Math.floor(Math.max(0, memoryTotalMb - 1024) / sessionCostMb)
  const headroomSessions = safeLimit - sessions
  const headroomMemoryMb = Math.max(0, usableMb - sessions * sessionCostMb)
  const ratio = safeLimit > 0 ? headroomSessions / safeLimit : -1
  let state = 'healthy'
  if (headroomSessions <= 0) state = 'critical'
  else if (ratio < 0.15) state = 'plan_now'
  else if (ratio <= 0.3) state = 'attention'
  const recommendation = state === 'healthy' ? 'Nenhuma mudança necessária; continue acompanhando o crescimento.' : `Planejar aumento de capacidade antes de ${safeLimit} sessões.`
  const health = evaluateResourceHealth(input)
  if (health.bottleneck && health.resources[health.bottleneck].state === 'critical') state = 'critical'
  else if (state === 'healthy' && health.bottleneck) state = 'attention'
  return { state, sessions, safeLimit, estimatedMaximum, headroomSessions, headroomMemoryMb, bottleneck: health.bottleneck || 'memory', resourceHealth: health.resources, recommendation, reserveMb, sessionCostMb, policyVersion: CAPACITY_POLICY_VERSION, reasons }
}
