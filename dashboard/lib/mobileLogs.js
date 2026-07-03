export const MOBILE_LOG_STATUS_TO_UI = {
  success: 'ok',
  error: 'falha',
  queued: 'fila',
  sending: 'fila',
  skipped: 'ignorado',
}

export const MOBILE_LOG_PLATFORM_LABEL = {
  shopee: 'Shopee',
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magalu',
  magalu: 'Magalu',
  aliexpress: 'AliExpress',
}

export function friendlyMobileLogError(errorMsg) {
  if (!errorMsg) return null
  if (errorMsg.startsWith('warning:amazon_cookies_expired')) return 'Seus cookies da Amazon expiraram. As ofertas continuam saindo, mas para gerar links curtos amzn.to renove em Conta → Credenciais → Amazon.'
  if (errorMsg.startsWith('warning:ml_ssid_expired')) return 'Sua credencial do Mercado Livre (SSID/cookie) expirou. As ofertas continuam saindo; renove em Conta → Credenciais → Mercado Livre para voltar a gerar links curtos.'
  if (errorMsg.startsWith('warning:ml_affiliate_forbidden')) return 'O Mercado Livre recusou a geração do link curto neste momento. As ofertas continuam saindo com link de afiliado longo; aguarde antes de tentar novamente.'
  if (errorMsg.startsWith('warning:ml_affiliate_rate_limited')) return 'O Mercado Livre limitou temporariamente as conversões. As ofertas continuam saindo com link de afiliado longo; o bot evita novas tentativas imediatas.'
  if (errorMsg.startsWith('warning:ml_affiliate_busy')) return 'Outra conversão do Mercado Livre já está usando esta credencial. Esta oferta saiu com link de afiliado longo para evitar disputa de sessão.'
  if (errorMsg.startsWith('skip:dedup')) return 'Esse link já foi enviado recentemente para esse destino — bloqueado para não duplicar. Ofertas de produto ficam bloqueadas por até 24h; links de cupom, só por alguns minutos.'
  if (errorMsg.startsWith('skip:blocked_keyword')) return 'Contém uma palavra que você marcou para bloquear.'
  if (errorMsg.startsWith('skip:title_mismatch')) return 'O texto da oferta não combina com o produto do link. Bloqueado por segurança.'
  if (errorMsg.startsWith('skip:text_too_large')) return 'Mensagem muito grande — ignorada para não atrasar o restante da fila.'
  if (errorMsg.startsWith('skip:no_valid_conversions')) return 'Nenhum link da mensagem pôde ser convertido em link de afiliado.'
  if (errorMsg.startsWith('skip:policy')) return errorMsg.endsWith(':unsupported_store') ? 'Ignorada: ainda não fazemos conversão de afiliado para essa loja.' : 'Mensagem fora das regras de encaminhamento que você configurou para este grupo.'
  if (errorMsg.startsWith('skip:decrypt_failed')) return 'O WhatsApp não conseguiu decifrar essa mensagem na sua ponta. Costuma ser pontual.'
  if (errorMsg.startsWith('skip:incoming_error')) {
    const detail = errorMsg.slice('skip:incoming_error'.length).replace(/^:/, '').trim()
    return detail
      ? `Tivemos um erro ao processar essa mensagem antes de enviar. Detalhe técnico: ${detail}`
      : 'Tivemos um erro ao processar essa mensagem antes de enviar.'
  }
  if (errorMsg.startsWith('timeout:send')) return 'O envio para o grupo/canal de destino demorou demais e foi cancelado.'
  if (errorMsg.startsWith('timeout:incoming')) return 'A leitura e o preparo dessa promoção demoraram demais. Costuma ser site de produto lento.'
  if (errorMsg.startsWith('error:queue_full')) return 'Fila interna de envios cheia neste instante — tente novamente em alguns minutos.'
  if (errorMsg.startsWith('error:worker_restart')) return 'O bot reiniciou enquanto essa mensagem estava esperando para ser enviada.'
  if (errorMsg.startsWith('error:channel_forbidden')) return 'O bot não tem permissão para postar nesse canal. Verifique se ele ainda é admin.'
  if (errorMsg.startsWith('error:channel_throttled')) return 'O WhatsApp limitou temporariamente os envios para esse canal. Tentaremos novamente.'
  if (errorMsg.startsWith('error:baileys')) return 'O WhatsApp recusou o envio. Pode ser instabilidade momentânea.'
  if (errorMsg.startsWith('error:conversion')) return `Não conseguimos converter o link em afiliado: ${errorMsg.slice('error:conversion:'.length)}`
  if (errorMsg.startsWith('error:other')) return errorMsg.slice('error:other:'.length) || 'Falha não classificada.'
  return errorMsg
}

export function isOfferAutomationLog(log = {}) {
  return log?.sourceGroup === 'offerAutomation' || log?.source === 'offerAutomation'
}

export function isRealMobileLogGroup(jid) {
  return typeof jid === 'string' && jid.includes('@') && jid !== 'skipped' && jid !== 'conversion' && jid !== 'offerAutomation'
}

export function mobileLogDayBucket(date, now) {
  const d = new Date(date)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60_000)
  if (d >= startOfToday) return 'hoje'
  if (d >= startOfYesterday) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}


function safeMobileLogUrl(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return trimmed
  } catch {
    return null
  }
}

export function isSafeMobileLogUrl(value) {
  return Boolean(safeMobileLogUrl(value))
}

export function mobileLogLinkActions(item = {}) {
  const actions = []
  if (item.link) {
    actions.push({ key: 'copy-original', kind: 'copy', label: 'Copiar original', value: item.link })
    const originalHref = safeMobileLogUrl(item.link)
    if (originalHref) {
      actions.push({ key: 'open-original', kind: 'open', label: 'Abrir original', href: originalHref })
    }
  }
  if (item.conv) {
    actions.push({ key: 'copy-converted', kind: 'copy', label: 'Copiar convertido', value: item.conv })
    const convertedHref = safeMobileLogUrl(item.conv)
    if (convertedHref) {
      actions.push({ key: 'open-converted', kind: 'open', label: 'Abrir convertido', href: convertedHref })
    }
  }
  return actions
}

export function toMobileLogItem(log = {}, now = new Date()) {
  const status = MOBILE_LOG_STATUS_TO_UI[log.status] || 'ignorado'
  const sentAt = new Date(log.sentAt)
  const firstLine = String(log.messageText || '').split('\n').find((line) => line.trim()) || ''
  const produto = (firstLine || log.convertedUrl || log.originalUrl || '(sem texto)').slice(0, 80)
  const source = isOfferAutomationLog(log) ? 'offerAutomation' : (isRealMobileLogGroup(log.sourceGroup) ? 'auto' : 'manual')
  return {
    id: log.id,
    status,
    source,
    hora: sentAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    day: mobileLogDayBucket(log.sentAt, now),
    loja: MOBILE_LOG_PLATFORM_LABEL[String(log.platform || '').toLowerCase()] || log.platform || '—',
    produto,
    de: source === 'offerAutomation' ? 'Oferta automática' : (source === 'auto' ? (log.sourceGroupName || log.sourceGroup) : 'Você criou'),
    para: isRealMobileLogGroup(log.destGroup) ? (log.destGroupName || log.destGroup) : null,
    link: log.originalUrl || null,
    conv: status === 'ok' && log.convertedUrl ? log.convertedUrl : null,
    erro: status === 'falha' ? friendlyMobileLogError(log.errorMsg) : null,
    motivo: status === 'ignorado' ? friendlyMobileLogError(log.errorMsg) : null,
    canRetryInMobile: false,
  }
}
