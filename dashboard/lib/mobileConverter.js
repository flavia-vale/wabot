export function normalizeMobileConversionResults(response = {}) {
  const results = Array.isArray(response?.results) ? response.results : []
  return results.map((result, fallbackIndex) => {
    const convertedUrl = String(result?.convertedUrl || '').trim()
    const originalUrl = String(result?.originalUrl || '').trim()
    const ok = result?.status === 'converted' && Boolean(convertedUrl)
    return {
      index: Number.isInteger(result?.index) ? result.index : fallbackIndex,
      label: result?.label || result?.platform || 'Link',
      platform: result?.platform || '',
      originalUrl,
      convertedUrl,
      displayUrl: ok ? convertedUrl : originalUrl,
      status: result?.status || (ok ? 'converted' : 'error'),
      ok,
      code: result?.code || null,
      warning: result?.warning || null,
      error: result?.error || (ok ? '' : 'Não foi possível converter este link.'),
    }
  })
}

export function getConvertedLinksText(items = []) {
  return items
    .filter((item) => item?.ok && item?.convertedUrl)
    .map((item) => item.convertedUrl)
    .join('\n')
}

export function getMobileConversionSummary(items = []) {
  const converted = items.filter((item) => item?.ok).length
  return {
    total: items.length,
    converted,
    failed: items.length - converted,
  }
}
