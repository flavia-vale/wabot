// 009-affiliate-improvements-r1 (US6): alarme operacional quando a promoção
// pending→eligible parou de avançar. Módulo puro — sem acesso a DB/env.

export function evaluateStuckPromotion({ rows = [], now = new Date(), thresholdMs = 24 * 60 * 60 * 1000 } = {}) {
  const nowMs = now.getTime()
  const stuck = rows.filter(r => r?.eligibleAt && (nowMs - new Date(r.eligibleAt).getTime()) > thresholdMs)
  if (!stuck.length) return { shouldAlarm: false, count: 0, oldestMs: 0 }

  const oldestMs = Math.max(...stuck.map(r => nowMs - new Date(r.eligibleAt).getTime()))
  return { shouldAlarm: true, count: stuck.length, oldestMs }
}
