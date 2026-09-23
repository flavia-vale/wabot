import crypto from 'node:crypto'
import db from '../db.js'
import { decryptCredential } from '../credentialCrypto.js'
import { createShopeeSalesClient, ShopeeSalesError } from './client.js'
import { splitSourceWindows } from './report.js'

export { ShopeeSalesError }
const TZ = 'America/Sao_Paulo'
const STATUSES = { PENDING: 'pending', UNPAID: 'unpaid', COMPLETED: 'confirmed', CONFIRMED: 'confirmed', APPROVED: 'confirmed', CANCELLED: 'cancelled', CANCELED: 'cancelled', REFUNDED: 'refunded' }
const finite = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
const safeText = (v, max = 160) => String(v || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max)
const opaque = value => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16)
const iso = value => { const n = Number(value); const d = new Date(n < 1e12 ? n * 1000 : n); return Number.isFinite(d.getTime()) ? d.toISOString() : null }
export function classifyStatus(value) { return STATUSES[String(value || '').toUpperCase()] || 'unclassified' }

export function validateSalesQuery(query = {}) {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(query.from || '') || !dateRe.test(query.to || '')) throw new ShopeeSalesError('INVALID_PERIOD', 'Informe um período válido.', false)
  const isCalendarDate = value => {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
  }
  if (!isCalendarDate(query.from) || !isCalendarDate(query.to)) throw new ShopeeSalesError('INVALID_PERIOD', 'Informe datas existentes no calendário.', false)
  if (query.timeZone && query.timeZone !== TZ) throw new ShopeeSalesError('INVALID_PERIOD', 'Fuso horário inválido.', false)
  const fromMs = Date.parse(`${query.from}T00:00:00-03:00`); const toExclusiveMs = Date.parse(`${query.to}T00:00:00-03:00`) + 86400000
  if (!Number.isFinite(fromMs) || !Number.isFinite(toExclusiveMs) || fromMs >= toExclusiveMs || (toExclusiveMs - fromMs) / 86400000 > 30) throw new ShopeeSalesError('INVALID_PERIOD', 'O período deve ter no máximo 30 dias.', false)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (query.to > today) throw new ShopeeSalesError('INVALID_PERIOD', 'O período não pode terminar no futuro.', false)
  const int = (v, fallback, max = Infinity) => { const n = v == null ? fallback : Number(v); if (!Number.isInteger(n) || n < 1 || n > max) throw new ShopeeSalesError('INVALID_PERIOD', 'Paginação inválida.', false); return n }
  return { from: query.from, to: query.to, timeZone: TZ, fromMs, toExclusiveMs, orderPage: int(query.orderPage, 1), productPage: int(query.productPage, 1), limit: int(query.limit, 20, 50) }
}

function page(rows, current, limit) { const start = (current - 1) * limit; return { page: current, limit, total: rows.length, hasNextPage: start + limit < rows.length, rows: rows.slice(start, start + limit) } }
export function buildSalesSnapshot(source, query, updatedAt = new Date()) {
  const seen = new Map()
  source.filter(c => String(c?.utmContent || '').trim().toLowerCase().startsWith('espelhagrupos')).forEach(c => {
    // Shopee may repeat a conversion at source-window/page boundaries. checkoutId
    // is the documented stable fallback; the digest is deliberately content based.
    const key = c.conversionId || c.checkoutId || `content:${opaque(JSON.stringify(c))}`; if (!seen.has(key)) seen.set(key, c)
  })
  const conversions = [...seen.values()]; const orders = []; const products = []; const orderKeys = new Set(); const productKeys = new Set()
  let sales = 0, salesComplete = true, estimated = 0, estimatedComplete = true, confirmed = 0, confirmedComplete = true, confirmedCount = 0, itemQuantity = 0
  const statusCounts = { pending: 0, unpaid: 0, confirmed: 0, cancelled: 0, refunded: 0, unclassified: 0 }
  for (const conversion of conversions) {
    const status = classifyStatus(conversion.conversionStatus); statusCounts[status]++
    const ec = finite(conversion.estimatedTotalCommission); if (ec == null) estimatedComplete = false; else estimated += ec
    const nc = finite(conversion.netCommission); if (status === 'confirmed') { confirmedCount++; if (nc == null) confirmedComplete = false; else confirmed += nc }
    if (!Array.isArray(conversion.orders) || conversion.orders.length === 0) salesComplete = false
    for (const order of conversion.orders || []) {
      const orderKey = order.orderId || `content:${opaque(JSON.stringify(order))}`; if (orderKeys.has(orderKey)) continue; orderKeys.add(orderKey)
      let amount = 0, amountComplete = true, count = 0
      const normalizedItems = new Map()
      if (!Array.isArray(order.items) || order.items.length === 0) { amountComplete = false; salesComplete = false }
      for (const item of order.items || []) {
        const productKey = `${orderKey}:${item.itemId || ''}:${item.modelId || ''}`; if (productKeys.has(productKey)) continue; productKeys.add(productKey)
        normalizedItems.set(productKey, item)
      }
      for (const [productKey, item] of normalizedItems) {
        const qty = Math.max(0, Number.parseInt(item.qty, 10) || 0); count += qty; itemQuantity += qty
        const itemAmount = finite(item.actualAmount ?? item.itemPrice); if (itemAmount == null) { amountComplete = false; salesComplete = false } else { amount += itemAmount; sales += itemAmount }
        const image = safeText(item.imageUrl, 500); let imageUrl = null; try { const u = new URL(image); if (u.protocol === 'https:' && /(^|\.)shopee\./i.test(u.hostname)) imageUrl = image } catch {}
        products.push({ id: opaque(productKey), name: safeText(item.itemName) || 'Produto Shopee', shopName: safeText(item.shopName) || null, quantity: qty, amount: itemAmount, status: classifyStatus(item.displayItemStatus), estimatedCommission: finite(item.itemTotalCommission), imageUrl, purchasedAt: iso(conversion.purchaseTime) })
      }
      const soleOrder = (conversion.orders || []).length === 1
      orders.push({ id: opaque(orderKey), purchasedAt: iso(conversion.purchaseTime), convertedClickAt: iso(conversion.clickTime), status: classifyStatus(order.orderStatus || conversion.conversionStatus), rawStatusLabel: safeText(order.orderStatus || conversion.conversionStatus, 40), amount: amountComplete ? amount : null, estimatedCommission: soleOrder ? ec : null, confirmedCommission: soleOrder && status === 'confirmed' ? nc : null, commissionScope: soleOrder ? 'conversion' : 'multiple_orders', itemCount: count })
    }
  }
  // Divisão Basic/PRO (2026-09-23): a tela do PRO mostra comissão POR DIA e
  // os produtos que mais venderam. Os dois saem do período INTEIRO, aqui —
  // calcular na tela a partir de uma página de pedidos daria número errado.
  // Dia sem comissão confiável em alguma compra vira null (nunca um total a
  // menos apresentado como se fosse o total).
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  const byDay = new Map()
  for (const conversion of conversions) {
    const at = iso(conversion.purchaseTime); if (!at) continue
    const day = dayFmt.format(new Date(at))
    const entry = byDay.get(day) ?? { date: day, purchases: 0, estimatedCommission: 0 }
    entry.purchases += 1
    const ec = finite(conversion.estimatedTotalCommission)
    entry.estimatedCommission = ec == null || entry.estimatedCommission == null ? null : entry.estimatedCommission + ec
    byDay.set(day, entry)
  }
  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  const byProduct = new Map()
  for (const product of products) {
    const key = `${product.name}|${product.shopName || ''}`
    const entry = byProduct.get(key) ?? { id: opaque(`top:${key}`), name: product.name, shopName: product.shopName, quantity: 0, estimatedCommission: 0 }
    entry.quantity += product.quantity
    entry.estimatedCommission = product.estimatedCommission == null || entry.estimatedCommission == null ? null : entry.estimatedCommission + product.estimatedCommission
    byProduct.set(key, entry)
  }
  const topProducts = [...byProduct.values()]
    .sort((a, b) => (b.estimatedCommission ?? -1) - (a.estimatedCommission ?? -1) || b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, 5)
  const sorter = (a, b) => String(b.purchasedAt || '').localeCompare(String(a.purchasedAt || '')) || a.id.localeCompare(b.id); orders.sort(sorter); products.sort(sorter)
  return { period: { from: query.from, to: query.to, timeZone: TZ }, summary: { attributedPurchases: conversions.length, orderCount: orders.length, itemQuantity, salesAmount: salesComplete ? sales : null, estimatedCommission: estimatedComplete ? estimated : null, confirmedCommission: confirmedCount && confirmedComplete ? confirmed : null, statusCounts }, orders: page(orders, query.orderPage, query.limit), products: page(products, query.productPage, query.limit), daily, topProducts, sourceUpdatedAt: updatedAt.toISOString(), stale: false, clickCoverage: 'converted_clicks_only' }
}

export function createShopeeSalesService({ database = db, client = createShopeeSalesClient() } = {}) {
  return { async getSnapshot(userId, rawQuery) {
    const query = validateSalesQuery(rawQuery)
    const row = await database.credential.findFirst({ where: { userId, platform: 'shopee' }, select: { data: true } })
    if (!row) throw new ShopeeSalesError('SHOPEE_NOT_CONFIGURED', 'Configure sua credencial da Shopee para ver as vendas.', false)
    let credentials; try { credentials = JSON.parse(decryptCredential(row.data)) } catch { throw new ShopeeSalesError('SHOPEE_CREDENTIAL_REJECTED', 'A credencial da Shopee é inválida.', false) }
    if (!credentials?.appId || !credentials?.secretKey) throw new ShopeeSalesError('SHOPEE_CREDENTIAL_REJECTED', 'A credencial da Shopee está incompleta.', false)
    const chunks = await Promise.all(splitSourceWindows(query.fromMs, query.toExclusiveMs).map(window => client.readWindow(credentials, window)))
    return buildSalesSnapshot(chunks.flat(), query)
  } }
}
