export function requiredString(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) throw new TypeError(`${field} obrigatório`)
  return normalized
}

export function optionalString(value) {
  if (value == null) return null
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

export function optionalHttpUrl(value, field) {
  const normalized = optionalString(value)
  if (!normalized) return null
  let parsed
  try {
    parsed = new URL(normalized)
  } catch {
    throw new TypeError(`${field} deve ser uma URL HTTP(S) válida`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError(`${field} deve ser uma URL HTTP(S) válida`)
  }
  return parsed.toString()
}

export function optionalNonNegativeInteger(value, field) {
  if (value == null || value === '') return null
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} deve ser um inteiro não negativo`)
  }
  return value
}

export function enumValue(value, allowed, field) {
  const normalized = requiredString(value, field)
  if (!allowed.includes(normalized)) throw new TypeError(`${field} inválido: ${normalized}`)
  return normalized
}

export function isoDate(value, field, { optional = false } = {}) {
  if (optional && (value == null || value === '')) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError(`${field} deve ser uma data válida`)
  return date.toISOString()
}

export function freezeSnapshot(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freezeSnapshot(child)
  return Object.freeze(value)
}
