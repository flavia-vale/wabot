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

export function validateMobileConverterInput(value = '') {
  const text = String(value || '').trim()
  if (!text) return 'Cole pelo menos um link para converter.'

  const httpLinks = text.match(/https?:\/\/\S+/gi) || []
  if (text.includes(';') && httpLinks.length >= 2) {
    return 'Separe múltiplos links por linha ou espaço. Não use ponto e vírgula entre links.'
  }

  return ''
}

export function buildMobileOfferUrlFromConversion(item, basePath = '/painel/criar-oferta') {
  if (!item?.ok || !String(item?.convertedUrl || '').trim()) return basePath
  const params = new URLSearchParams({ url: String(item.convertedUrl).trim() })
  return `${basePath}?${params.toString()}`
}
