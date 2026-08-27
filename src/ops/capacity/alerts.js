export const CAPACITY_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000
const rank = { attention: 1, plan_now: 2, critical: 3 }
const evidence = (condition) => Object.fromEntries(Object.entries(condition.observedValues || {}).filter(([key, value]) => !/(token|secret|password|cookie|authorization)/i.test(key) && (value == null || ['string', 'number', 'boolean'].includes(typeof value))).slice(0, 20))
const alertEvidence = (alert) => { if (alert?.observedValues && typeof alert.observedValues === 'object') return alert.observedValues; try { return JSON.parse(alert?.observedValuesJson || '{}') } catch { return {} } }

/** Two-sample activation/recovery; notification is due on activation, worsening, or after cooldown. */
export function transitionCapacityAlert(previous, condition, { hostProfileId, now = new Date(), cooldownMs = CAPACITY_ALERT_COOLDOWN_MS, policyVersion = 'capacity-policy-v1' } = {}) {
  const breached = condition.breached === true; const base = previous || { status: 'pending', consecutiveBreaches: 0, consecutiveRecoveries: 0, firstObservedAt: now, lastNotifiedAt: null, severity: condition.severity }
  const startsOccurrence = breached && (base.status === 'recovered' || !previous || Number(base.consecutiveBreaches || 0) === 0)
  let status = base.status; let breaches = breached ? base.consecutiveBreaches + 1 : 0; let recoveries = breached ? 0 : base.consecutiveRecoveries + 1
  if (breached && breaches >= 2) status = 'active'
  if (!breached && base.status === 'active' && recoveries >= 2) status = 'recovered'
  if (!breached && base.status === 'pending') status = 'pending'
  const worsening = status === 'active' && (rank[condition.severity] || 0) > (rank[base.severity] || 0)
  const cooldownElapsed = !base.lastNotifiedAt || now - new Date(base.lastNotifiedAt) >= cooldownMs
  const notify = status === 'active' && (base.status !== 'active' || worsening || cooldownElapsed)
  const recoveryNotify = status === 'recovered' && base.status === 'active'
  return { hostProfileId, type: condition.type, conditionKey: `${hostProfileId}:${condition.type}`, status, severity: condition.severity, firstObservedAt: startsOccurrence ? now : (base.firstObservedAt || now), lastObservedAt: now, consecutiveBreaches: breaches, consecutiveRecoveries: recoveries, lastNotifiedAt: notify || recoveryNotify ? now : base.lastNotifiedAt, recoveredAt: status === 'recovered' ? now : null, observedValues: evidence(condition), recommendation: String(condition.recommendation || ''), policyVersion, notify, recoveryNotify }
}

export async function evaluateCapacityAlerts({ repository, host, snapshot, previous = null, now = new Date(), notify } = {}) {
  const prior = await repository.listAlerts(host.id, { limit: 500 }); const byType = new Map(prior.map((a) => [a.type, a]))
  const conditions = buildCapacityAlertConditions(snapshot, { now, previous })
  // An OOM counter delta is an edge, not a level. Keep that single conclusive
  // edge latched for the second sample required by the anti-noise lifecycle.
  const oom = conditions.find((item) => item.type === 'oom_kill')
  const priorOom = byType.get('oom_kill')
  const priorOomEvidence = alertEvidence(priorOom)
  if (oom && !oom.breached && priorOom?.status === 'pending' && Number(priorOom.consecutiveBreaches) === 1 && Number(priorOomEvidence.countDelta) > 0) {
    oom.breached = true
    oom.observedValues = { countDelta: Number(priorOomEvidence.countDelta), latched: true }
  }
  const results = []
  for (const condition of conditions) { const next = transitionCapacityAlert(byType.get(condition.type), condition, { hostProfileId: host.id, now, policyVersion: snapshot.policyVersion }); const { notify: shouldNotify, recoveryNotify, ...stored } = next; const saved = await repository.upsertAlert(stored); if (shouldNotify || recoveryNotify) { await repository.createEvent?.(host.id, { type: recoveryNotify ? 'capacity_alert_recovered' : 'capacity_alert_notified', occurredAt: now, source: 'capacity_alerts', severity: recoveryNotify ? 'info' : stored.severity, title: recoveryNotify ? `Alerta recuperado: ${stored.type}` : `Alerta de capacidade: ${stored.type}`, details: { type: stored.type, recommendation: stored.recommendation }, dedupeKey: `capacity_alert:${stored.type}:${recoveryNotify ? 'recovered' : 'active'}:${new Date(now).toISOString()}` }); if (notify) await notify({ ...stored, recovered: recoveryNotify }) } results.push(saved) }
  return results
}

/** All operational conditions are explicit and independently testable. */
export function buildCapacityAlertConditions(snapshot = {}, { now = new Date(), previous = null } = {}) {
  const state = snapshot.operationalState
  const horizonDays = snapshot.forecastHorizonDays == null ? null : Number(snapshot.forecastHorizonDays)
  const disk = Number(snapshot.diskUsedPercent)
  const swapOut = Number(snapshot.swapOutKbPerSec)
  const ageMinutes = snapshot.collectedAt ? (now - new Date(snapshot.collectedAt)) / 60000 : Infinity
  const divergence = Number.isFinite(Number(snapshot.productionWorkers)) && Number.isFinite(Number(snapshot.connectedSessions)) ? Math.abs(Number(snapshot.productionWorkers) - Number(snapshot.connectedSessions)) : null
  const oomDelta = previous && Number.isFinite(Number(previous.oomKillCount)) && Number.isFinite(Number(snapshot.oomKillCount)) ? Number(snapshot.oomKillCount) - Number(previous.oomKillCount) : 0
  return [
    { type: 'capacity_margin', breached: ['attention', 'plan_now', 'critical'].includes(state), severity: state === 'critical' ? 'critical' : state === 'plan_now' ? 'plan_now' : 'attention', observedValues: { state, headroomSessions: snapshot.headroomSessions, headroomMemoryMb: snapshot.headroomMemoryMb }, recommendation: 'Planeje capacidade antes de atingir a margem segura.' },
    { type: 'forecast_horizon', breached: horizonDays != null && horizonDays <= 30, severity: horizonDays != null && horizonDays <= 7 ? 'critical' : horizonDays != null && horizonDays <= 14 ? 'plan_now' : 'attention', observedValues: { horizonDays }, recommendation: 'Defina a janela de expansão antes do horizonte previsto.' },
    { type: 'swap_pressure', breached: swapOut > 0 && Number(snapshot.memoryAvailableMb) / Number(snapshot.memoryTotalMb) < .2, severity: swapOut >= 100 ? 'critical' : 'attention', observedValues: { swapOutKbPerSec: snapshot.swapOutKbPerSec, memoryAvailableMb: snapshot.memoryAvailableMb }, recommendation: 'Investigue pressão contínua de memória; swap não é capacidade adicional.' },
    { type: 'disk_usage', breached: Number.isFinite(disk) && disk >= 75, severity: disk >= 90 ? 'critical' : disk >= 85 ? 'plan_now' : 'attention', observedValues: { diskUsedPercent: snapshot.diskUsedPercent }, recommendation: 'Revise crescimento, retenção e expansão do disco.' },
    { type: 'oom_kill', breached: oomDelta > 0, severity: 'critical', observedValues: { countDelta: Math.max(0, oomDelta) }, recommendation: 'Investigue imediatamente o processo encerrado e a pressão de memória.' },
    { type: 'collection_stale', breached: ageMinutes > 15, severity: ageMinutes > 60 ? 'critical' : 'attention', observedValues: { ageMinutes: Number.isFinite(ageMinutes) ? Math.round(ageMinutes) : null }, recommendation: 'Restaure a coleta antes de interpretar a capacidade.' },
    { type: 'worker_session_divergence', breached: divergence != null && divergence > 0, severity: divergence >= 2 ? 'plan_now' : 'attention', observedValues: { productionWorkers: snapshot.productionWorkers, connectedSessions: snapshot.connectedSessions, difference: divergence }, recommendation: 'Reconcilie workers reais e sessões conectadas.' },
    { type: 'staging_idle', breached: snapshot.stagingOnline === true && Number(snapshot.stagingWorkers || 0) === 0 && Number(snapshot.stagingIdleMinutes || 0) >= 24 * 60, severity: 'attention', observedValues: { stagingOnline: snapshot.stagingOnline, stagingWorkers: snapshot.stagingWorkers, stagingRssMb: snapshot.stagingRssMb, idleHours: Math.floor(Number(snapshot.stagingIdleMinutes || 0) / 60) }, recommendation: 'Se não houver validação em curso, desligue staging pelo controle auditado.' },
  ]
}
