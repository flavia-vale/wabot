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

// Cupom de CÓDIGO (a pessoa digita no carrinho) ou de LINK (entra e resgata no
// site). Linha antiga sem `kind` é cupom de código.
export const COUPON_KINDS = ['code', 'link']

// Domínios de cada loja aceitos no link de resgate — os mesmos que o detector
// de links (src/detector.js, PATTERNS) reconhece como da loja, inclusive os
// encurtadores da própria loja. Guarda contra divergência em
// test/cupom-link-minimo-teto.test.js. Checagem ANCORADA no fim do endereço:
// `shopee.com.br.site-falso.com` não passa (mesma lição do T070 da SHEIN).
export const COUPON_LINK_DOMAINS = {
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com', 'meli.la', 'mluvem.com'],
  amazon: ['amazon.com.br', 'link.amazon', 'amzn.to', 'amzn.la', 'a.co', 'amzn.divulgador.link', 'amzn.divulguei.app', 'amzlink.to'],
  shopee: ['shope.ee', 'shopee.com.br'],
  magazineluiza: ['magazineluiza.com.br', 'magazinevoce.com.br', 'mlz.me'],
  shein: ['shein.com', 'onelink.shein.com', 'shein.top'],
  aliexpress: ['aliexpress.com', 'aliexpress.us'],
}

// true só para https, sem usuário/senha no endereço, e host da loja escolhida.
export function isStoreCouponLink(url, platform) {
  const domains = COUPON_LINK_DOMAINS[platform]
  if (!domains) return false
  let parsed
  try {
    parsed = new URL(String(url ?? '').trim())
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  const host = parsed.hostname.toLowerCase()
  return domains.some((d) => host === d || host.endsWith(`.${d}`))
}

function couponKind(coupon) {
  return coupon?.kind === 'link' ? 'link' : 'code'
}

function optionalCents(value) {
  return isFiniteNumber(value) && value > 0 ? value : null
}

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
  // Cupom de código precisa do código; cupom de link precisa de um link da
  // própria loja — link inválido nunca chega ao grupo, mesmo se escapar do
  // cadastro.
  if (couponKind(coupon) === 'link') return isStoreCouponLink(coupon.redeemUrl, coupon.platform)
  return String(coupon.code ?? '').trim() !== ''
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

// Com preço conhecido, cupom com compra mínima acima do preço NÃO se aplica a
// esta oferta (decisão da dona do produto, 2026-09-25): nunca prometer um
// desconto que o produto sozinho não alcança. Sem preço, vale — a condição
// sai escrita no texto e a pessoa confere.
function meetsMinimum(coupon, priceCents) {
  const min = optionalCents(coupon.minPurchaseCents)
  if (min == null || !hasReliablePrice(priceCents)) return true
  return priceCents >= min
}

function savingsForCoupon(coupon, priceCents) {
  if (coupon.discountType === 'percent') {
    // % limitada ao teto de desconto (quando cadastrado) e ao preço.
    let savings = Math.round((priceCents * coupon.discountValue) / 100)
    const cap = optionalCents(coupon.maxDiscountCents)
    if (cap != null) savings = Math.min(savings, cap)
    return Math.min(savings, priceCents)
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
      if (!meetsMinimum(coupon, priceCents)) return false
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

// Preço vindo de fora (tela, fila, agendado) em centavos. Qualquer coisa que
// não seja inteiro positivo vira null = "preço desconhecido", e aí vale a ordem
// fixa do FR-011 e não sai o "de X por Y" (nunca inventar preço).
export function sanitizePriceCents(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return Number.isInteger(n) && n > 0 ? n : null
}

export function formatBrl(cents) {
  const value = isFiniteNumber(cents) ? cents / 100 : 0
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * renderCouponText({ coupon, priceCents, finalPriceCents }) → string
 */
// Valor redondo sem centavos ("R$ 10"), quebrado com centavos ("R$ 10,50").
function formatBrlShort(cents) {
  const full = formatBrl(cents)
  return isFiniteNumber(cents) && cents % 100 === 0 ? full.replace(/,00$/, '') : full
}

// Só o desconto ("10% OFF" / "R$ 10 OFF"). Compra mínima e desconto máximo
// NÃO aparecem na mensagem — servem só para escolher o cupom e decidir se ele
// vale (decisão da dona do produto, 2026-09-26).
export function describeCouponDiscount(coupon) {
  if (!coupon || typeof coupon !== 'object') return ''
  if (coupon.discountType === 'percent') return `${coupon.discountValue}% OFF`
  if (isFiniteNumber(coupon.discountValue)) return `${formatBrlShort(coupon.discountValue)} OFF`
  return ''
}

// Modelo aprovado em 2026-09-26: preço com cupom em *negrito*; o link vai
// sozinho na linha de baixo, depois de um título em negrito com a setinha.
//   🎟️ Resgate o cupom de R$ 10 OFF e pague *R$ 117,00*
//   *Resgate aqui seu cupom* ⤵️
//   https://…
export function renderCouponText({ coupon, priceCents, finalPriceCents } = {}) {
  if (!coupon || typeof coupon !== 'object') return ''
  const discount = describeCouponDiscount(coupon)
  const off = discount ? ` de ${discount}` : ''
  const withPrice = hasReliablePrice(priceCents) && isFiniteNumber(finalPriceCents) && finalPriceCents > 0
  const pay = withPrice ? ` e pague *${formatBrl(finalPriceCents)}*` : ''
  const url = String(coupon.redeemUrl ?? '').trim()
  // O link só sai se for da própria loja (mesma checagem do cadastro).
  const storeLink = url && isStoreCouponLink(url, coupon.platform) ? url : ''

  if (couponKind(coupon) === 'link') {
    if (!storeLink) return ''
    return `🎟️ Resgate o cupom${off}${pay}\n*Resgate aqui seu cupom* ⤵️\n${storeLink}`
  }

  const code = String(coupon.code || '').trim()
  if (!code) return ''
  const line = `🎟️ Use o cupom ${code}${off}${pay}`
  // Link opcional da página onde se insere o código: só sai se preenchido.
  return storeLink ? `${line}\n*Insira aqui o código do cupom* ⤵️\n${storeLink}` : line
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
    .replace(/\*[ \t]*\*/g, '')
    .replace(/~[ \t]*~/g, '')
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
