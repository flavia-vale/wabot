import dbDefault from '../../db.js'
import { PLATFORMS } from '../../credentialHealth.js'
import { reloadWorkerConfig as defaultReloadWorkerConfig } from '../workerConfigReload.js'

const PLATFORM_SET = new Set(PLATFORMS)

// FR-006: mensagens sempre em português simples, nunca o nome do campo
// técnico (data-model.md, tabela de validação).
function validateCouponBody(body = {}, { partial = false } = {}) {
  const hasField = (key) => Object.prototype.hasOwnProperty.call(body, key)

  if (!partial || hasField('code')) {
    const code = String(body.code ?? '').trim()
    if (!code) return 'Escreva o código do cupom, do jeito que a loja te deu.'
  }

  if (!partial || hasField('platform')) {
    const platform = String(body.platform ?? '').trim()
    if (!platform) return 'Escolha em qual loja este cupom vale.'
    if (!PLATFORM_SET.has(platform)) return 'Esta loja ainda não é aceita.'
  }

  const discountType = hasField('discountType') ? String(body.discountType ?? '').trim() : null
  if (!partial && !discountType) return 'Escolha o tipo de desconto: porcentagem ou valor fixo.'
  if (discountType && discountType !== 'percent' && discountType !== 'amount') {
    return 'Escolha o tipo de desconto: porcentagem ou valor fixo.'
  }

  // A regra de faixa depende do TIPO efetivo (o do corpo, quando presente; em
  // PUT parcial sem discountType novo, a validação de faixa é pulada aqui —
  // quem decide o tipo final é a rota, que já tem o registro salvo).
  if (hasField('discountValue')) {
    const value = Number(body.discountValue)
    const effectiveType = discountType
    if (effectiveType === 'percent') {
      if (!Number.isFinite(value) || value < 1 || value > 100) return 'A porcentagem precisa ser entre 1 e 100.'
    } else if (effectiveType === 'amount') {
      if (!Number.isFinite(value) || value <= 0) return 'O valor do desconto precisa ser maior que zero.'
    } else if (!partial) {
      // Sem discountType (já barrado acima em !partial), nunca chega aqui.
    }
  } else if (!partial) {
    return 'Informe o valor do desconto.'
  }

  if (hasField('validUntil') && body.validUntil != null && body.validUntil !== '') {
    const parsed = new Date(body.validUntil)
    if (Number.isNaN(parsed.getTime())) return 'Não consegui entender essa data de validade.'
  }

  return null
}

function normalizeValidUntil(value) {
  if (value == null || value === '') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// `expired` é calculado na resposta, nunca gravado — tela e envio usam a
// MESMA definição de vencido (FR-005). Espelha a comparação de
// src/core/clientCouponPolicy.js (validUntil == null || validUntil >= now).
function presentCoupon(coupon, now = new Date()) {
  const expired = coupon.validUntil != null && new Date(coupon.validUntil).getTime() < now.getTime()
  return {
    id: coupon.id,
    code: coupon.code,
    label: coupon.label,
    platform: coupon.platform,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
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
    const body = req.body ?? {}
    const error = validateCouponBody(body, { partial: false })
    if (error) return reply.code(400).send({ error })

    const platform = String(body.platform).trim()
    const code = String(body.code).trim()

    const duplicate = await db.clientCoupon.findFirst({
      where: { userId: req.user.sub, platform, code },
      select: { id: true },
    })

    const coupon = await db.clientCoupon.create({
      data: {
        userId: req.user.sub,
        code,
        label: body.label != null ? String(body.label).trim() || null : null,
        platform,
        discountType: String(body.discountType).trim(),
        discountValue: Math.round(Number(body.discountValue)),
        validUntil: normalizeValidUntil(body.validUntil),
        enabled: true,
      },
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

    const body = req.body ?? {}
    const error = validateCouponBody(body, { partial: true })
    if (error) return reply.code(400).send({ error })

    const data = {}
    if (Object.prototype.hasOwnProperty.call(body, 'code')) data.code = String(body.code).trim()
    if (Object.prototype.hasOwnProperty.call(body, 'label')) data.label = body.label != null ? String(body.label).trim() || null : null
    if (Object.prototype.hasOwnProperty.call(body, 'platform')) data.platform = String(body.platform).trim()
    if (Object.prototype.hasOwnProperty.call(body, 'discountType')) data.discountType = String(body.discountType).trim()
    if (Object.prototype.hasOwnProperty.call(body, 'discountValue')) data.discountValue = Math.round(Number(body.discountValue))
    if (Object.prototype.hasOwnProperty.call(body, 'validUntil')) data.validUntil = normalizeValidUntil(body.validUntil)

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

export const __couponsInternals = { validateCouponBody, presentCoupon }
