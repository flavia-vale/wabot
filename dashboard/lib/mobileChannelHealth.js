const HEALTH_MAP = {
  green: { label: 'saudável', tone: 'success' },
  yellow: { label: 'atenção', tone: 'warn' },
  red: { label: 'risco', tone: 'danger' },
  critical: { label: 'risco', tone: 'danger' },
}

export function getHealthChipStyle(status) {
  return HEALTH_MAP[status] ?? { label: '—', tone: 'neutral' }
}
