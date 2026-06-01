function hash32(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

export function pickVariant(bucket, groupId, date, random = false) {
  if (!Array.isArray(bucket) || bucket.length === 0) return ''
  if (bucket.length === 1) return bucket[0]
  if (random) return bucket[Math.floor(Math.random() * bucket.length)]
  const idx = hash32(`${groupId}|${date}`) % bucket.length
  return bucket[idx]
}

const PLACEHOLDER_RE = /\{\{(greeting|cta|trailer)\}\}/g

export function applyVariation(text, opts = {}) {
  const { groupId, date, pool, poolJson, random = false } = opts
  if (text == null) return text
  let p = pool
  if (!p && poolJson) {
    try { p = typeof poolJson === 'string' ? JSON.parse(poolJson) : poolJson } catch { p = null }
  }
  if (!p || typeof p !== 'object') return text

  const today = date ?? new Date().toISOString().slice(0, 10)

  const greeting = pickVariant(p.greetings, groupId, today, random)
  const cta = pickVariant(p.ctas, groupId, today + 'c', random)
  const trailer = pickVariant(p.trailers, groupId, today + 't', random)

  if (PLACEHOLDER_RE.test(text)) {
    PLACEHOLDER_RE.lastIndex = 0
    return text.replace(PLACEHOLDER_RE, (_, key) => {
      if (key === 'greeting') return greeting
      if (key === 'cta') return cta
      if (key === 'trailer') return trailer
      return ''
    })
  }

  return `${greeting}${text}${trailer}`
}
