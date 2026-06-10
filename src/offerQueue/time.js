export function startOfSaoPauloDayUtc(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const localMidnightGuess = new Date(`${values.year}-${values.month}-${values.day}T00:00:00-03:00`)
  return localMidnightGuess
}
