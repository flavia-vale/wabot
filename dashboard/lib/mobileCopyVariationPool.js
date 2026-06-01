const EMPTY_POOL = () => ({ greetings: [], ctas: [], trailers: [] })

export function parsePool(jsonStr) {
  if (jsonStr == null || jsonStr === '') return EMPTY_POOL()
  try {
    const parsed = JSON.parse(jsonStr)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY_POOL()
    const normalizeStringArray = (value) =>
      Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
    return {
      greetings: normalizeStringArray(parsed.greetings),
      ctas: normalizeStringArray(parsed.ctas),
      trailers: normalizeStringArray(parsed.trailers),
    }
  } catch {
    return EMPTY_POOL()
  }
}

export function writePool(pool) {
  const greetings = (pool?.greetings ?? []).map((s) => s.trim()).filter(Boolean)
  const ctas = (pool?.ctas ?? []).map((s) => s.trim()).filter(Boolean)
  const trailers = (pool?.trailers ?? []).map((s) => s.trim()).filter(Boolean)
  if (greetings.length === 0 && ctas.length === 0 && trailers.length === 0) return ''
  return JSON.stringify({ greetings, ctas, trailers })
}

export function countPool(pool) {
  const greetings = pool?.greetings?.length ?? 0
  const ctas = pool?.ctas?.length ?? 0
  const trailers = pool?.trailers?.length ?? 0
  return { greetings, ctas, trailers, total: greetings + ctas + trailers }
}
