/* Tradução dos prefixos canônicos de MessageLog.errorMsg para linguagem de
 * cliente, no novo painel. Mantém-se sincronizado com src/errorTaxonomy.js e
 * com a taxonomia canônica de erros exibida no painel de envios.
 * É copy de UI — não muda nenhuma regra de negócio. */

export function explainErrorMsg(errorMsg) {
  if (!errorMsg) return null
  if (errorMsg.startsWith('warning:amazon_cookies_expired')) {
    return 'Seus cookies da Amazon (sitestripe) expiraram. As ofertas continuam saindo com link longo de afiliado e creditando comissão, mas para voltar a gerar links curtos amzn.to, renove os cookies em IDs de afiliada → Amazon.'
  }
  if (errorMsg.startsWith('warning:ml_ssid_expired')) {
    return 'Sua credencial do Mercado Livre (SSID/cookie) expirou. As ofertas continuam saindo com link longo de afiliado (partner_id) e creditando comissão, mas para voltar a gerar links curtos meli.la, renove o SSID em IDs de afiliada → Mercado Livre.'
  }
  if (errorMsg.startsWith('skip:dedup')) return 'Link já enviado nas últimas 2 horas — bloqueado para não duplicar.'
  if (errorMsg.startsWith('skip:blocked_keyword')) return 'Contém uma palavra que você marcou para bloquear.'
  if (errorMsg.startsWith('skip:title_mismatch')) return 'O texto da oferta não combina com o produto do link. Bloqueado por segurança.'
  if (errorMsg.startsWith('skip:text_too_large')) return 'Mensagem muito grande — ignorada para não atrasar o restante da fila.'
  if (errorMsg.startsWith('skip:no_valid_conversions')) return 'Nenhum link da mensagem pôde ser convertido em link de afiliado.'
  if (errorMsg.startsWith('skip:policy')) {
    if (errorMsg.endsWith(':unsupported_store')) return 'Essa promoção foi ignorada porque ainda não fazemos conversão automática de afiliado para essa loja.'
    return 'Mensagem fora das regras de encaminhamento que você configurou para este grupo.'
  }
  if (errorMsg.startsWith('skip:decrypt_failed')) return 'O WhatsApp não conseguiu decifrar essa mensagem na sua ponta. Costuma ser pontual.'
  if (errorMsg.startsWith('skip:incoming_error')) return 'Tivemos um erro ao processar essa mensagem antes de enviar.'
  if (errorMsg.startsWith('timeout:send')) return 'O envio para o canal/grupo de destino demorou demais e foi cancelado.'
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

export const STATUS_TAG = {
  success: { cls: 'is-success', label: 'enviado' },
  error: { cls: 'is-error', label: 'falhou' },
  skipped: { cls: 'is-skip', label: 'ignorado' },
  queued: { cls: 'is-flight', label: 'na fila' },
  sending: { cls: 'is-flight', label: 'enviando' },
}

export const STATUS_TABS = [
  ['all', 'Todos'],
  ['success', 'Enviados'],
  ['skipped', 'Ignorados'],
  ['error', 'Falhas'],
  ['queued', 'Na fila'],
  ['sending', 'Enviando'],
]

export function statusTag(status) {
  return STATUS_TAG[status] || { cls: 'is-skip', label: status || '—' }
}
