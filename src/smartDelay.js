export function clampNonNegativeInteger(value, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.floor(number))
}

export function calculateJitterDelayMs({ delayMin = 0, delayMax = 0, random = Math.random } = {}) {
  const minSec = clampNonNegativeInteger(delayMin)
  const maxSec = clampNonNegativeInteger(delayMax, minSec)
  const low = Math.min(minSec, maxSec)
  const high = Math.max(minSec, maxSec)
  if (high <= 0) return 0
  const span = high - low + 1
  return (low + Math.floor(random() * span)) * 1000
}

export function calculateProgressiveDelayMs({
  baseDelayMs = 0,
  queueSize = 0,
  threshold = 20,
  stepMs = 5_000,
  maxExtraMs = 60_000,
} = {}) {
  const base = clampNonNegativeInteger(baseDelayMs)
  const size = clampNonNegativeInteger(queueSize)
  const safeThreshold = Math.max(1, clampNonNegativeInteger(threshold, 20))
  const safeStep = clampNonNegativeInteger(stepMs, 5_000)
  const safeMaxExtra = clampNonNegativeInteger(maxExtraMs, 60_000)
  if (size < safeThreshold || safeStep === 0 || safeMaxExtra === 0) return base
  const pressureSteps = Math.floor((size - safeThreshold) / safeThreshold) + 1
  return base + Math.min(safeMaxExtra, pressureSteps * safeStep)
}

export function calculateRestWindowDelayMs({
  sentCount = 0,
  every = 0,
  durationMs = 0,
} = {}) {
  const count = clampNonNegativeInteger(sentCount)
  const safeEvery = clampNonNegativeInteger(every)
  const safeDuration = clampNonNegativeInteger(durationMs)
  if (!safeEvery || !safeDuration || !count) return 0
  return count % safeEvery === 0 ? safeDuration : 0
}

export function calculateTypingDelayMs({ text = '', minMs = 1200, maxMs = 7000, charsPerSecond = 18 } = {}) {
  const rawText = String(text ?? '')
  const safeMin = clampNonNegativeInteger(minMs, 1200)
  const safeMax = Math.max(safeMin, clampNonNegativeInteger(maxMs, 7000))
  const cps = Math.max(1, Number(charsPerSecond) || 18)
  const estimated = Math.ceil((rawText.length / cps) * 1000)
  return Math.min(safeMax, Math.max(safeMin, estimated))
}
