import logger from '../logger.js'

export function parseEnumEnv(name, rawValue, allowed, fallback, { log = logger, level = 'warn' } = {}) {
  const normalized = String(rawValue ?? '').trim().toLowerCase()
  const allowedSet = new Set(allowed)
  if (allowedSet.has(normalized)) return normalized
  if (normalized && log?.[level]) {
    log[level]({ env: name, value: rawValue, allowed, fallback }, 'Valor de env inválido; aplicando fallback seguro')
  }
  return fallback
}

export function logModeSummary(scope, summary, { log = logger } = {}) {
  if (!log?.info) return
  log.info({ scope, ...summary }, 'Mode summary')
}
