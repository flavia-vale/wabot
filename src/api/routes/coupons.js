import dbDefault from '../../db.js'
import { PLATFORMS } from '../../credentialHealth.js'
import { reloadWorkerConfig as defaultReloadWorkerConfig } from '../workerConfigReload.js'
import { COUPON_KINDS, isStoreCouponLink } from '../../core/clientCouponPolicy.js'

const PLATFORM_SET = new Set(PLATFORMS)

const STORE_NAMES = {
  shopee: 'Shopee',
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magazine Luiza',
  shein: 'SHEIN',
  aliexpress: 'AliExpress',
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key)

// Campo opcional em centavos: vazio/null = sem condição; qualquer outra coisa
// precisa ser número maior que zero.
function readOptionalCents(value) {
  if (value == null || value === '') return { ok: true, value: null }
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return { ok: false }
  return { ok: true, value: Math.round(n) }
}

// Monta o cupom EFETIVO (o salvo + o que chegou no corpo, em PUT) e valida o
// conjunto — tipo de cupom, loja e tipo de desconto dependem uns dos outros
// (link precisa ser da loja; teto só existe para porcentagem).
// FR-006: mensagens sempre em português simples, nunca o nome do campo técnico.
function buildCoupon(body = {}, existing = null) {
  const pick = (key, fallback) => (has(body, key) ? body[key] : (existing ? existing[key] : fallback))

  const kind = String(pick('kind', 'code') ?? 'code').trim() || 'code'
  if (!COUPON_KINDS.includes(kind)) return { error: 'Escolha como o cupom é usado: com código ou por link.' }

  const platform = String(pick('platform', '') ?? '').trim()
  if (!platform) return { error: 'Escolha em qual loja este cupom vale.' }
  if (!PLATFORM_SET.has(platform)) return { error: 'Esta loja ainda não é aceita.' }

  let code = ''
  let redeemUrl = null
  if (kind === 'code') {
    code = String(pick('code', '') ?? '').trim()
    if (!code) return { error: 'Escreva o código do cupom, do jeito que a loja te deu.' }
  } else {
    redeemUrl = String(pick('redeemUrl', '') ?? '').trim()
    let parsed = null
    try { parsed = new URL(redeemUrl) } catch { parsed = null }
    if (!parsed || parsed.protocol !== 'https:') return { error: 'Cole o link completo do cupom, começando com https://.' }
    if (!isStoreCouponLink(redeemUrl, platform)) {
      const loja = STORE_NAMES[platform] ?? 'escolhida'
      return { error: `Este link não é da loja ${loja}. Cole o link de resgate que a própria loja te deu.` }
    }
  }

  const discountType = String(pick('discountType', '') ?? '').trim()
  if (discountType !== 'percent' && discountType !== 'amount') {
    return { error: 'Escolha o tipo de desconto: porcentagem ou valor fixo.' }
  }

  const rawValue = pick('discountValue', null)
  if (rawValue == null || rawValue === '') return { error: 'Informe o valor do desconto.' }
  const value = Number(rawValue)
  if (discountType === 'percent') {
    if (!Number.isFinite(value) || value < 1 || value > 100) return { error: 'A porcentagem precisa ser entre 1 e 100.' }
  } else if (!Number.isFinite(value) || value <= 0) {
    return { error: 'O valor do desconto precisa ser maior que zero.' }
  }

  const min = readOptionalCents(pick('minPurchaseCents', null))
  if (!min.ok) return { error: 'A compra mínima precisa ser um valor maior que zero.' }

  let maxDiscountCents = null
  if (discountType === 'percent') {
    const max = readOptionalCents(pick('maxDiscountCents', null))
    if (!max.ok) return { error: 'O desconto máximo precisa ser um valor maior que zero.' }
    maxDiscountCents = max.value
  }

  const rawValidUntil = pick('validUntil', null)
  let validUntil = null
  if (rawValidUntil != null && rawValidUntil !== '') {
    validUntil = new Date(rawValidUntil)
    if (Number.isNaN(validUntil.getTime())) return { error: 'Não consegui entender essa data de validade.' }
  }

  const rawLabel = pick('label', null)
  const label = rawLabel != null ? String(rawLabel).trim() || null : null

  return {
    data: {
      kind,
      code,
      redeemUrl,
      label,
      platform,
      discountType,
      discountValue: Math.round(value),
      minPurchaseCents: min.value,
      maxDiscountCents,
      validUntil,
    },
  }
}

// `expired` é calculado na resposta, nunca gravado — tela e envio usam a
// MESMA definição de vencido (FR-005). Espelha a comparação de
// src/core/clientCouponPolicy.js (validUntil == null || validUntil >= now).
function presentCoupon(coupon, now = new Date()) {
  const expired = coupon.validUntil != null && new Date(coupon.validUntil).getTime() < now.getTime()
  return {
    id: coupon.id,
    kind: coupon.kind === 'link' ? 'link' : 'code',
    code: coupon.code,
    redeemUrl: coupon.redeemUrl ?? null,
    label: coupon.label,
    platform: coupon.platform,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    minPurchaseCents: coupon.minPurchaseCents ?? null,
    maxDiscountCents: coupon.maxDiscountCents ?? null,
    validUntil: coupon.validUntil,
    enabled: coupon.enabled,
    expired,
    createdAt: coupon.createdAt,
  }
}

export async function couponsRoutes(app, opts = {}) {
  const db = opts.db ?? dbDefault
  const reloadWorkerConfig = (userId) => (opts.reloadWorkerConfig ?? defaultReloadWorkerConfig)(userId, { reloadConfig: opts.reloadConfig })

  async function logReload(userId, action, extra = {}) {
    const result = await reloadWorkerConfig(userId)
    app.log.info({ userId, action, couponReloaded: result.ok, couponReloadError: result.error, ...extra }, 'Cupom alterado; configuração do worker recarregada quando disponível')
    return result
  }

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const coupons = await db.clientCoupon.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    return { coupons: coupons.map((c) => presentCoupon(c, now)) }
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { error, data } = buildCoupon(req.body ?? {})
    if (error) return reply.code(400).send({ error })

    const duplicate = await db.clientCoupon.findFirst({
      where: data.kind === 'link'
        ? { userId: req.user.sub, platform: data.platform, kind: 'link', redeemUrl: data.redeemUrl }
        : { userId: req.user.sub, platform: data.platform, code: data.code },
      select: { id: true },
    })

    const coupon = await db.clientCoupon.create({
      data: { userId: req.user.sub, ...data, enabled: true },
    })

    await logReload(req.user.sub, 'created', { couponId: coupon.id })

    return reply.code(201).send({
      ...presentCoupon(coupon),
      ...(duplicate ? { duplicateWarning: true } : {}),
    })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.clientCoupon.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!existing) return reply.code(404).send({ error: 'Cupom não encontrado.' })

    const { error, data } = buildCoupon(req.body ?? {}, existing)
    if (error) return reply.code(400).send({ error })

    const updated = await db.clientCoupon.update({ where: { id: existing.id }, data })
    await logReload(req.user.sub, 'updated', { couponId: updated.id })
    return presentCoupon(updated)
  })

  app.patch('/:id/enabled', { onRequest: [app.authenticate] }, async (req, reply) => {
    const existing = await db.clientCoupon.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!existing) return reply.code(404).send({ error: 'Cupom não encontrado.' })

    const enabled = req.body?.enabled === true
    const updated = await db.clientCoupon.update({ where: { id: existing.id }, data: { enabled } })
    // FR-014: esta é a rota mais sensível — é o reload aqui que faz o
    // desligamento valer nos próximos envios (dentro do teto de
    // CONFIG_CACHE_TTL_MS quando a invalidação ativa se perde).
    await logReload(req.user.sub, 'toggled', { couponId: updated.id, enabled: updated.enabled })
    return { id: updated.id, enabled: updated.enabled }
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    // findFirst por id+userId ANTES do delete (mesmo padrão de groups.js):
    // garante que uma cliente nunca apaga cupom de outra, mesmo adivinhando o
    // id (FR-007) — e distingue "não existe" de "não é seu" só na resposta
    // idempotente, sem vazar qual dos dois é o caso.
    const existing = await db.clientCoupon.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    let deleted = false
    if (existing) {
      try {
        await db.clientCoupon.delete({ where: { id: existing.id } })
        deleted = true
      } catch (err) {
        if (err?.code !== 'P2025') throw err
      }
    }
    if (deleted) await logReload(req.user.sub, 'deleted', { couponId: req.params.id })
    return { deleted }
  })
}

export const __couponsInternals = { buildCoupon, presentCoupon }
