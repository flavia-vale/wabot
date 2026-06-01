export function normalizeSummaryCounts(counts) {
  const toNonNegativeNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }
  return {
    success: toNonNegativeNumber(counts?.success),
    skippedDedup: toNonNegativeNumber(counts?.skippedDedup),
    skippedConfig: toNonNegativeNumber(counts?.skippedConfig),
    timeoutTotal: toNonNegativeNumber(counts?.timeoutTotal),
    errorOther: toNonNegativeNumber(counts?.errorOther),
    inFlight: toNonNegativeNumber(counts?.inFlight),
  }
}

export function summaryDeliveryRateLabel(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) return '—'
  return `${Math.round(rate * 100)}%`
}
