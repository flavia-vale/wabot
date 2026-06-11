export const DEFAULT_COPY_VARIATION_POOL = {
  greetings: [
    '🚨 COOOOOORRE QUE TÁ ACABANDO!',
    '💡 UTILIDADE PÚBLICA!!',
    '😱 TÁ BARATOOO DEMAIS!',
    '🍌 PREÇO DE BANANA!!',
    '🔥 PARA TUDO E OLHA ISSO!',
    '💸 O GERENTE ENLOUQUECEU!!',
    '⚡ OFERTA RELÂMPAGO, CLICA JÁ!',
    '🎁 QUASE DE GRAÇA, SÉRIO!!',
    '💎 ACHADO DE MILHÕES!!',
    '🏃 VOLTOU PRO ESTOQUE, VOA!',
    '💥 CHOCADO COM ESSE VALOR!',
    '🤑 SÓ QUEM FOR RÁPIDO VAI PEGAR!',
  ],
  ctas: [
    '⚠️ Atenção: Preços e estoque podem mudar a qualquer momento!',
    '🚨 O valor promocional e a disponibilidade dependem do estoque da loja.',
    '⏳ Corra! Oferta por tempo limitado ou até durarem os estoques.',
    '📝 Preço sujeito a alteração e produto sujeito a esgotar sem aviso prévio.',
    '🏃💨 Garanta logo, porque o estoque voa e o preço pode subir rapidinho!',
    '🔔 Aviso: A loja parceira pode alterar o valor ou encerrar a oferta a qualquer minuto.',
    '🛒 Unidades promocionais limitadas! Preço sujeito a reajuste no site.',
    '📉 Desconto válido por tempo limitado, sujeito a alteração e fim de estoque.',
    'ℹ️ Os preços e a disponibilidade do produto são de responsabilidade total da loja.',
    '💥 Aproveite rápido: Estoques limitados e valores sujeitos a alteração.',
  ],
  trailers: [
    '📲 Entre no nosso grupo oficial:',
    '👥 Vem pro grupo economizar com a gente:',
    '👇 Clique aqui e faça parte do nosso grupo VIP:',
    '🤫 Acesse nosso grupo secreto de ofertas:',
    '🚀 Receba os melhores achadinhos direto no grupo:',
    '🔔 Quer ver as promoções primeiro? Entre no grupo:',
    '💥 Não perca nenhum bug! Faça parte do grupo:',
    '🛒 Garanta os melhores descontos entrando no grupo:',
    '🤝 Junte-se à nossa comunidade de achadinhos:',
    '👀 Para não perder nadinha, vem pro grupo:',
  ],
}

export const DEFAULT_COPY_VARIATION_POOL_JSON = JSON.stringify(DEFAULT_COPY_VARIATION_POOL)

function isEmptyObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
}

function bucketHasContent(bucket) {
  return Array.isArray(bucket) && bucket.some(item => String(item ?? '').trim() !== '')
}

export function isEmptyCopyVariationPool(pool) {
  if (!pool || typeof pool !== 'object' || Array.isArray(pool)) return false
  if (isEmptyObject(pool)) return true
  const hasCanonicalBuckets = ['greetings', 'ctas', 'trailers'].every(key => Array.isArray(pool[key]))
  if (!hasCanonicalBuckets) return false
  return !bucketHasContent(pool.greetings) && !bucketHasContent(pool.ctas) && !bucketHasContent(pool.trailers)
}

export function resolveCopyVariationPoolJson(poolJson) {
  if (poolJson == null || String(poolJson).trim() === '') return DEFAULT_COPY_VARIATION_POOL_JSON
  try {
    const parsed = typeof poolJson === 'string' ? JSON.parse(poolJson) : poolJson
    if (isEmptyCopyVariationPool(parsed)) return DEFAULT_COPY_VARIATION_POOL_JSON
    return typeof poolJson === 'string' ? poolJson : JSON.stringify(parsed)
  } catch {
    return DEFAULT_COPY_VARIATION_POOL_JSON
  }
}

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

const PLACEHOLDER_RE = /\{\{(gancho|cta|convitegrupo)\}\}/g
const LINK_RE_GRUPO = /\{\{grupoLink\}\}/g
const LINK_RE_CUPOM = /\{\{cupomLink\}\}/g

export function applyVariation(text, opts = {}) {
  const { groupId, date, pool, poolJson, random = false, groupInviteLink = '', couponLink = '', autoInjectWhenMissing = true } = opts
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
      if (key === 'gancho') return greeting
      if (key === 'cta') return cta
      if (key === 'convitegrupo') return trailer
      return ''
    })
  }

  if (!autoInjectWhenMissing) return result

  const prefix = greeting ? `${greeting}\n\n` : ''
  const suffix = trailer ? `\n\n${trailer}` : ''

  if (!cta) return `${prefix}${result}${suffix}`

  // Inserir CTA antes da última seção (a linha do link 👉)
  const lastSep = result.lastIndexOf('\n\n')
  if (lastSep < 0) return `${prefix}${result}\n\n${cta}${suffix}`
  return `${prefix}${result.slice(0, lastSep)}\n\n${cta}\n${result.slice(lastSep + 2)}${suffix}`
}
