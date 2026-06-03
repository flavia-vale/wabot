const DAILY_INTERVAL_MINUTES = 1440
const DEFAULT_DAILY_TIME_ZONE = 'America/Sao_Paulo'
const DAILY_RUN_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function normalizeDailyRunTime(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  return DAILY_RUN_TIME_RE.test(text) ? text : null
}

function brtParts(date, timeZone = DEFAULT_DAILY_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

function isDailyRunDue(automation, now) {
  const dailyRunTime = normalizeDailyRunTime(automation.dailyRunTime)
  if (!dailyRunTime) return null

  const nowParts = brtParts(now)
  if (nowParts.time < dailyRunTime) return false

  if (!automation.lastSentAt) return true
  const lastSentParts = brtParts(new Date(automation.lastSentAt))
  return lastSentParts.day !== nowParts.day
}

export function isOfferAutomationDue(automation, now = new Date()) {
  if (Number(automation.intervalMinutes) === DAILY_INTERVAL_MINUTES) {
    const dailyDue = isDailyRunDue(automation, now)
    if (dailyDue !== null) return dailyDue
  }

  const dueAt = automation.lastSentAt
    ? new Date(new Date(automation.lastSentAt).getTime() + Number(automation.intervalMinutes) * 60_000)
    : new Date(0)

  return now >= dueAt
}
