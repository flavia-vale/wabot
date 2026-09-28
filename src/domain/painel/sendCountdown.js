export function formatSendCountdown(value, now = Date.now()) {
  if (!value) return null
  const target = new Date(value).getTime()
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null
  const seconds = Math.max(0, Math.ceil((target - now) / 1000))
  if (seconds === 0) return 'sai agora'
  if (seconds < 60 * 60) {
    const minutes = Math.floor(seconds / 60)
    const rest = String(seconds % 60).padStart(2, '0')
    return `sai em ${minutes}:${rest}`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.ceil((seconds % 3600) / 60)
  if (hours < 24) return `sai em ${hours}h${minutes ? ` ${minutes}min` : ''}`
  const days = Math.ceil(seconds / 86400)
  return `sai em ${days}d`
}

