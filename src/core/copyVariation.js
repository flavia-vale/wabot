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
const LINK_RE_GRUPO = /\{\{grupoLink\}\}/g
const LINK_RE_CUPOM = /\{\{cupomLink\}\}/g

export function applyVariation(text, opts = {}) {
  const { groupId, date, pool, poolJson, random = false, groupInviteLink = '', couponLink = '' } = opts
  if (text == null) return text
  let p = pool
  if (!p && poolJson) {
    try { p = typeof poolJson === 'string' ? JSON.parse(poolJson) : poolJson } catch { p = null }
  }

  // Substituição de links independe do pool
  let result = text
  if (groupInviteLink !== undefined) result = result.replace(LINK_RE_GRUPO, groupInviteLink ?? '')
  if (couponLink !== undefined) result = result.replace(LINK_RE_CUPOM, couponLink ?? '')

  if (!p || typeof p !== 'object') return result

  const today = date ?? new Date().toISOString().slice(0, 10)

  const greeting = pickVariant(p.greetings, groupId, today, random)
  const cta = pickVariant(p.ctas, groupId, today + 'c', random)
  const trailer = pickVariant(p.trailers, groupId, today + 't', random)

  if (PLACEHOLDER_RE.test(result)) {
    PLACEHOLDER_RE.lastIndex = 0
    return result.replace(PLACEHOLDER_RE, (_, key) => {
      if (key === 'greeting') return greeting
      if (key === 'cta') return cta
      if (key === 'trailer') return trailer
      return ''
    })
  }

  const prefix = greeting ? `${greeting}\n\n` : ''
  const suffix = trailer ? `\n\n${trailer}` : ''

  if (!cta) return `${prefix}${result}${suffix}`

  // Inserir CTA antes da última seção (a linha do link 👉)
  const lastSep = result.lastIndexOf('\n\n')
  if (lastSep < 0) return `${prefix}${result}\n\n${cta}${suffix}`
  return `${prefix}${result.slice(0, lastSep)}\n\n${cta}\n${result.slice(lastSep + 2)}${suffix}`
}
