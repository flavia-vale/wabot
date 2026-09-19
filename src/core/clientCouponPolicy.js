// Regra pura de escolha do cupom da própria cliente (specs/017-client-coupon-catalog).
//
// PURA de propósito, verificada por teste estrutural (SC-007): não importa
// `db`, Prisma, `fetch`, Redis, Baileys nem nada de `dashboard/`; nenhuma
// função exportada é `async`; `Date.now()` nunca é lido aqui dentro — o
// instante entra por parâmetro (`now`), senão o caso "cupom que vence entre o
// cadastro e o envio" não é determinístico.
//
// Nome `clientCouponPolicy.js`, não `couponPolicy.js` — já existe
// `src/converters/couponPolicy.js` (a flag COUPON_LINK_CONVERT), que é outra
// coisa inteiramente.

const KNOWN_PLATFORMS = new Set(['amazon', 'mercadolivre', 'shopee', 'magazineluiza', 'shein', 'aliexpress'])

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasReliablePrice(priceCents) {
  return isFiniteNumber(priceCents) && priceCents > 0
}

function isValidCouponShape(coupon) {
  if (!coupon || typeof coupon !== 'object') return false
  if (coupon.enabled !== true) return false
  if (typeof coupon.platform !== 'string' || !coupon.platform) return false
  if (coupon.discountType !== 'percent' && coupon.discountType !== 'amount') return false
  if (!isFiniteNumber(coupon.discountValue) || coupon.discountValue <= 0) return false
  return true
}

function isNotExpired(coupon, now) {
  if (coupon.validUntil == null) return true
  const validUntil = coupon.validUntil instanceof Date ? coupon.validUntil.getTime() : new Date(coupon.validUntil).getTime()
  if (!Number.isFinite(validUntil)) return true // data ilegível: melhor deixar valer do que descartar por engano
  return validUntil >= now
}

function createdAtMs(coupon) {
  const value = coupon?.createdAt
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function savingsForCoupon(coupon, priceCents) {
  if (coupon.discountType === 'percent') {
    return Math.round((priceCents * coupon.discountValue) / 100)
  }
  // amount: centavos. Teto do FR-009 — nunca economiza mais que o próprio preço.
  return Math.min(coupon.discountValue, priceCents)
}

/**
 * chooseCoupon({ coupons, platform, priceCents, now })
 * → { coupon, savingsCents, finalPriceCents } | null
 */
export function chooseCoupon({ coupons, platform, priceCents, now } = {}) {
  if (typeof platform !== 'string' || !platform || !KNOWN_PLATFORMS.has(platform)) return null
  if (!Array.isArray(coupons)) return null
  // `now` é sempre passado pelo chamador (nunca Date.now() interno — ver
  // cabeçalho do módulo). Entrada inválida cai em 0: qualquer `validUntil`
  // real (positivo) passa a ser tratado como "ainda não vencido" — fail-safe
  // que nunca descarta cupom legítimo por causa de um `now` malformado.
  const parsedNow = isFiniteNumber(now) ? now : Date.parse(now)
  const referenceNow = Number.isFinite(parsedNow) ? parsedNow : 0

  const candidates = coupons.filter((coupon) => {
    try {
      if (!isValidCouponShape(coupon)) return false
      if (coupon.platform !== platform) return false
      if (!isNotExpired(coupon, referenceNow)) return false
      return true
    } catch {
      return false
    }
  })

  if (candidates.length === 0) return null

  const priceReliable = hasReliablePrice(priceCents)

  let winner
  if (priceReliable) {
    let best = null
    for (const coupon of candidates) {
      let savingsCents
      try {
        savingsCents = savingsForCoupon(coupon, priceCents)
      } catch {
        continue
      }
      if (!isFiniteNumber(savingsCents) || savingsCents < 0) continue
      if (
        !best ||
        savingsCents > best.savingsCents ||
        (savingsCents === best.savingsCents && createdAtMs(coupon) > createdAtMs(best.coupon))
      ) {
        best = { coupon, savingsCents }
      }
    }
    if (!best) return null
    winner = best
  } else {
    // Sem preço confiável: ordem fixa e previsível (FR-011), nunca comparação inventada.
    const sorted = [...candidates].sort((a, b) => {
      // 1) maior percent; 2) depois maior amount; 3) depois mais recente.
      if (a.discountType === 'percent' && b.discountType !== 'percent') return -1
      if (a.discountType !== 'percent' && b.discountType === 'percent') return 1
      if (b.discountValue !== a.discountValue) return b.discountValue - a.discountValue
      return createdAtMs(b) - createdAtMs(a)
    })
    winner = { coupon: sorted[0], savingsCents: null }
  }

  const { coupon, savingsCents } = winner
  let finalPriceCents = null
  if (priceReliable && isFiniteNumber(savingsCents)) {
    const candidate = priceCents - savingsCents
    if (candidate > 0) finalPriceCents = candidate
  }

  return { coupon, savingsCents: priceReliable ? savingsCents : null, finalPriceCents }
}

export function formatBrl(cents) {
  const value = isFiniteNumber(cents) ? cents / 100 : 0
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * renderCouponText({ coupon, priceCents, finalPriceCents }) → string
 */
export function renderCouponText({ coupon, priceCents, finalPriceCents } = {}) {
  if (!coupon || typeof coupon !== 'object') return ''
  const code = String(coupon.code || '').trim()
  if (!code) return ''

  if (hasReliablePrice(priceCents) && isFiniteNumber(finalPriceCents) && finalPriceCents > 0) {
    return `🎟️ Use o cupom ${code} — de ${formatBrl(priceCents)} por ${formatBrl(finalPriceCents)} com o cupom`
  }

  if (coupon.discountType === 'percent') {
    return `🎟️ Use o cupom ${code} (${coupon.discountValue}% de desconto)`
  }
  return `🎟️ Use o cupom ${code} (${formatBrl(coupon.discountValue)} de desconto)`
}

/**
 * applyCouponToken(text, couponText) → substitui/limpa {cupom}
 */
export function applyCouponToken(text, couponText) {
  const source = String(text ?? '')
  const resolved = String(couponText ?? '').trim()

  let result
  if (!resolved) {
    // Sem cupom aplicável: remove a linha inteira do token, não deixa lacuna.
    result = source
      .replace(/^[ \t]*\{cupom\}[ \t]*(?:\r?\n|$)/gm, '')
      .replace(/\{cupom\}/g, '')
  } else {
    result = source.replace(/\{cupom\}/g, resolved)
  }

  return result
    .replace(/\(\s*\)/g, '')
    .replace(/\*\s*\*/g, '')
    .replace(/~\s*~/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^\s*(?:💰|💥|👉|🛒|🎟️|🎟)?\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const PRICE_RANGE_RE = /\bà\s*partir\b|\ba\s*partir\b|R\$[^R]*\ba\s+R\$/i
const PRICE_HTTP_RE = /https?:\/\//i

/**
 * parseOfferPriceToCents(text) → centavos ou null
 */
export function parseOfferPriceToCents(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  if (PRICE_RANGE_RE.test(raw)) return null
  if (PRICE_HTTP_RE.test(raw)) return null

  const match = raw.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/)
  if (!match) return null
  const intPart = match[1].replace(/\./g, '')
  const centPart = (match[2] || '00').padEnd(2, '0').slice(0, 2)
  const cents = Number(`${intPart}${centPart}`)
  if (!Number.isFinite(cents) || cents <= 0) return null
  return cents
}
