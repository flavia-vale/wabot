import { sanitizeCapacityValue } from './contract.js'

const iso = (value) => new Date(value || Date.now()).toISOString()
const snapshotComponents = (snapshot) => {
  if (Array.isArray(snapshot?.components)) return snapshot.components
  try { const parsed = JSON.parse(snapshot?.componentsJson || '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}
const componentMap = (snapshot) => new Map(snapshotComponents(snapshot).filter((item) => item?.key).map((item) => [item.key, item]))
const event = (type, occurredAt, title, details = {}, severity = 'info', source = 'collector') => ({
  type, occurredAt: new Date(occurredAt), source, severity, title,
  details: sanitizeCapacityValue(details) || {},
  dedupeKey: `${type}:${iso(occurredAt)}:${details.key || details.environment || 'host'}`,
})

/** Derives explanatory annotations only from two persisted observations. */
export function deriveCapacityEvents(previous, current) {
  if (!previous || !current) return []
  const at = current.collectedAt || new Date()
  const events = []
  if (Number.isFinite(previous.uptimeSeconds) && Number.isFinite(current.uptimeSeconds) && current.uptimeSeconds < previous.uptimeSeconds) {
    events.push(event('host_restart', at, 'Host reiniciado', { previousUptimeSeconds: previous.uptimeSeconds, uptimeSeconds: current.uptimeSeconds }, 'attention', 'linux'))
  }
  if (typeof previous.stagingOnline === 'boolean' && typeof current.stagingOnline === 'boolean' && previous.stagingOnline !== current.stagingOnline) {
    events.push(event('staging_changed', at, current.stagingOnline ? 'Staging ligado' : 'Staging desligado', { environment: 'staging', online: current.stagingOnline }, 'info', 'pm2'))
  }
  const before = componentMap(previous)
  for (const component of snapshotComponents(current)) {
    const old = before.get(component.key)
    if (!old || !Number.isFinite(old.restartCount) || !Number.isFinite(component.restartCount) || component.restartCount <= old.restartCount) continue
    events.push(event('process_restart', at, `${component.key} reiniciado`, { key: component.key, environment: component.environment, restartDelta: component.restartCount - old.restartCount }, 'info', 'pm2'))
  }
  const previousOom = Number(previous.oomKillCount)
  const currentOom = Number(current.oomKillCount)
  if (Number.isFinite(previousOom) && Number.isFinite(currentOom) && currentOom > previousOom) {
    events.push(event('oom_kill', at, 'Processo encerrado por falta de memória', { countDelta: currentOom - previousOom }, 'critical', 'linux'))
  }
  if (previous.policyVersion && current.policyVersion && previous.policyVersion !== current.policyVersion) {
    events.push(event('policy_changed', at, 'Política de capacidade alterada', { previousPolicyVersion: previous.policyVersion, policyVersion: current.policyVersion }, 'info', 'policy'))
  }
  const hostFields = ['hostKey', 'serverType', 'contractedVcpu', 'contractedMemoryMb', 'contractedDiskMb']
  const changed = hostFields.filter((key) => previous[key] != null && current[key] != null && previous[key] !== current[key])
  if (changed.length) events.push(event('host_capacity_changed', at, 'Host ou capacidade contratada alterada', { changedFields: changed.join(',') }, 'attention', 'inventory'))
  if (previous.deploymentRevision && current.deploymentRevision && previous.deploymentRevision !== current.deploymentRevision) {
    events.push(event('deploy', at, 'Nova versão implantada', { revision: current.deploymentRevision }, 'info', 'deployment_marker'))
  }
  return events
}
