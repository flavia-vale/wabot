export const SHOPEE_SALES_SELECTION = `
  clickTime purchaseTime checkoutId conversionId conversionStatus utmContent
  estimatedTotalCommission netCommission totalCommission
  orders { orderId orderStatus shopType items {
    itemId modelId itemName shopId shopName qty itemPrice actualAmount refundAmount
    displayItemStatus fraudStatus completeTime imageUrl itemTotalCommission
  } }
`

export function splitSourceWindows(fromMs, toExclusiveMs, maxDays = 7) {
  const size = maxDays * 86400000
  const windows = []
  for (let start = fromMs; start < toExclusiveMs; start += size) {
    windows.push({ start: Math.floor(start / 1000), end: Math.floor(Math.min(start + size, toExclusiveMs) / 1000) - 1 })
  }
  return windows
}

export function conversionReportQuery({ start, end, scrollId }) {
  const cursor = scrollId ? `, scrollId: ${JSON.stringify(scrollId)}` : ''
  return `query { conversionReport(purchaseTimeStart: ${start}, purchaseTimeEnd: ${end}${cursor}) { nodes { ${SHOPEE_SALES_SELECTION} } pageInfo { scrollId hasNextPage } } }`
}
