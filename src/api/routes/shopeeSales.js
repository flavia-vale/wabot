import dbDefault from '../../db.js'
import { createShopeeSalesService } from '../../shopeeSales/service.js'
import { buildFeatureGateError, canUseShopeeSales, FEATURE_CODES } from '../../billing/plans.js'
const STATUS = { INVALID_PERIOD: 400, SHOPEE_NOT_CONFIGURED: 404, SHOPEE_CREDENTIAL_REJECTED: 422, SHOPEE_UNAVAILABLE: 502, SHOPEE_REPORT_INCOMPLETE: 502 }
const PUBLIC_MESSAGE = {
  INVALID_PERIOD: 'Informe um período válido de até 30 dias.',
  SHOPEE_NOT_CONFIGURED: 'Configure sua credencial da Shopee para ver as vendas.',
  SHOPEE_CREDENTIAL_REJECTED: 'A Shopee recusou a credencial cadastrada.',
  SHOPEE_UNAVAILABLE: 'A Shopee está indisponível no momento.',
  SHOPEE_REPORT_INCOMPLETE: 'A Shopee não entregou o relatório completo.',
}
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]]))
const sanitizePage = (value, rowKeys) => ({
  ...pick(value, ['page', 'limit', 'total', 'hasNextPage']),
  rows: Array.isArray(value?.rows) ? value.rows.map(row => pick(row, rowKeys)) : [],
})
export function publicSalesSnapshot(value = {}) {
  const period = pick(value.period, ['from', 'to', 'timeZone'])
  const summary = pick(value.summary, ['attributedPurchases', 'orderCount', 'itemQuantity', 'salesAmount', 'estimatedCommission', 'confirmedCommission'])
  summary.statusCounts = pick(value.summary?.statusCounts, ['pending', 'unpaid', 'confirmed', 'cancelled', 'refunded', 'unclassified'])
  return {
    period, summary,
    orders: sanitizePage(value.orders, ['id', 'purchasedAt', 'convertedClickAt', 'status', 'rawStatusLabel', 'amount', 'estimatedCommission', 'confirmedCommission', 'commissionScope', 'itemCount']),
    products: sanitizePage(value.products, ['id', 'name', 'shopName', 'quantity', 'amount', 'estimatedCommission', 'status', 'imageUrl', 'purchasedAt']),
    daily: Array.isArray(value.daily) ? value.daily.map(row => pick(row, ['date', 'purchases', 'estimatedCommission'])) : [],
    topProducts: Array.isArray(value.topProducts) ? value.topProducts.map(row => pick(row, ['id', 'name', 'shopName', 'quantity', 'estimatedCommission'])) : [],
    ...pick(value, ['sourceUpdatedAt', 'stale', 'clickCoverage']),
  }
}
export async function shopeeSalesRoutes(app, options = {}) {
  const service = options.service || createShopeeSalesService()
  const db = options.db ?? dbDefault
  // Divisão Basic/PRO (2026-09-23): o painel de vendas e comissão da Shopee é
  // do PRO. A trava vem ANTES da consulta à Shopee — Basic não gasta chamada.
  const loadPlanSubject = options.loadPlanSubject
    ?? (userId => db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } }))
  app.get('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const subject = await loadPlanSubject(req.user.sub)
    if (!canUseShopeeSales(subject ?? { plan: 'basic' })) {
      return reply.code(403).send(buildFeatureGateError(FEATURE_CODES.SHOPEE_SALES))
    }
    try { return publicSalesSnapshot(await service.getSnapshot(req.user.sub, req.query)) }
    catch (error) {
      const known = Boolean(STATUS[error?.code]); const code = known ? error.code : 'SHOPEE_UNAVAILABLE'
      const message = known ? PUBLIC_MESSAGE[code] : 'Não foi possível consultar a Shopee.'
      return reply.code(STATUS[code]).send({ error: message, code, retryable: known ? Boolean(error.retryable) : true })
    }
  })
}
