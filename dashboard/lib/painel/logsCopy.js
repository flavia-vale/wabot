/* Tradução dos prefixos canônicos de MessageLog.errorMsg para linguagem de
 * cliente, no novo painel. Mantém-se sincronizado com src/errorTaxonomy.js e
 * com a taxonomia canônica de erros exibida no painel de envios.
 * É copy de UI — não muda nenhuma regra de negócio. */

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds ? `${minutes}min ${seconds}s` : `${minutes}min`
}

// skip:dedup_recent_link(_global)?:age=<segundos>s:window=<segundos>s — sufixo
// de diagnóstico (RCA de cupom preso em dedup) que grava HÁ QUANTO TEMPO o
// bloqueio anterior aconteceu, direto no errorMsg. Rows antigas (sem sufixo,
// gravadas antes desse fix) caem no texto genérico abaixo.
function parseDedupAgeSuffix(errorMsg) {
  const m = errorMsg.match(/:age=(\d+)s:window=(\d+)s/)
  if (!m) return null
  return { ageSeconds: Number(m[1]), windowSeconds: Number(m[2]) }
}

export function explainErrorMsg(errorMsg) {
  if (!errorMsg) return null
  if (errorMsg.startsWith('warning:amazon_cookies_expired')) {
    return 'Seus cookies da Amazon (sitestripe) expiraram. As ofertas continuam saindo com link longo de afiliado e creditando comissão, mas para voltar a gerar links curtos amzn.to, renove os cookies em IDs de afiliada → Amazon.'
  }
  if (errorMsg.startsWith('warning:ml_ssid_expired')) {
    return 'Sua credencial do Mercado Livre (SSID/cookie) expirou. As ofertas continuam saindo com link longo de afiliado (partner_id) e creditando comissão, mas para voltar a gerar links curtos meli.la, renove o SSID em IDs de afiliada → Mercado Livre.'
  }
  if (errorMsg.startsWith('warning:ml_affiliate_forbidden')) {
    return 'O Mercado Livre recusou a geração do link curto neste momento (403). As ofertas continuam saindo com link longo de afiliado (partner_id); aguarde antes de tentar novamente ou revise a sessão se o bloqueio persistir.'
  }
  if (errorMsg.startsWith('warning:ml_affiliate_rate_limited')) {
    return 'O Mercado Livre limitou temporariamente as conversões (429). As ofertas continuam saindo com link longo de afiliado (partner_id), e o bot evita novas tentativas imediatas para proteger a sessão.'
  }
  if (errorMsg.startsWith('warning:ml_affiliate_busy')) {
    return 'Outra conversão do Mercado Livre já estava usando esta credencial. A oferta saiu com link longo para evitar disputa de sessão.'
  }
  if (errorMsg.startsWith('warning:ml_vitrine_fallback_used')) {
    return 'Esse link era uma vitrine/perfil de outra loja, que o Mercado Livre não aceita converter em link de afiliado. A oferta saiu usando o link da SUA vitrine, cadastrado em IDs de afiliada → Mercado Livre.'
  }
  if (errorMsg.startsWith('error:conversion:') && errorMsg.includes('Cadastre o link da SUA vitrine')) {
    return 'Esse link era uma vitrine/perfil de outra loja, que o Mercado Livre não aceita converter em link de afiliado. Cadastre o link da SUA vitrine em IDs de afiliada → Mercado Livre para que esses casos saiam com seu link automaticamente, em vez de serem descartados.'
  }
  if (errorMsg.startsWith('skip:dedup')) {
    const age = parseDedupAgeSuffix(errorMsg)
    if (age) {
      return `Esse link já tinha sido enviado para esse destino há ${formatDuration(age.ageSeconds)} — bloqueado para não duplicar (janela desse tipo de link: ${formatDuration(age.windowSeconds)}).`
    }
    return 'Esse link já foi enviado recentemente para esse destino — bloqueado para não duplicar. Ofertas de produto ficam bloqueadas por até 24h; links de cupom, só por alguns minutos.'
  }
  if (errorMsg.startsWith('skip:ml_vitrine_missing')) {
    return 'Esse link era uma vitrine/perfil de outra loja. A oferta foi ignorada porque você ainda não cadastrou o link da SUA vitrine. Cadastre em IDs de afiliada → Mercado Livre para que esses casos saiam com o seu link automaticamente.'
  }
  if (errorMsg.startsWith('skip:blocked_keyword')) return 'Contém uma palavra que você marcou para bloquear.'
  if (errorMsg.startsWith('skip:title_mismatch')) return 'O texto da oferta não combina com o produto do link. Bloqueado por segurança.'
  if (errorMsg.startsWith('skip:text_too_large')) return 'Mensagem muito grande — ignorada para não atrasar o restante da fila.'
  if (errorMsg.startsWith('skip:no_valid_conversions')) return 'Nenhum link da mensagem pôde ser convertido em link de afiliado.'
  if (errorMsg.startsWith('skip:policy')) {
    if (errorMsg.endsWith(':unsupported_store')) return 'Essa promoção foi ignorada porque ainda não fazemos conversão automática de afiliado para essa loja.'
    return 'Mensagem fora das regras de encaminhamento que você configurou para este grupo.'
  }
  if (errorMsg.startsWith('skip:queue_cleared')) return 'Você limpou a fila de envios manualmente — esta oferta foi removida da fila antes de ser enviada.'
  if (errorMsg.startsWith('skip:queue_expired')) {
    const m = /age=(\d+)min:max=(\d+)min/.exec(errorMsg)
    if (m) {
      return `Essa oferta esperou ${formatDuration(Number(m[1]) * 60)} na fila desse destino e foi descartada — o limite de espera que você configurou é ${formatDuration(Number(m[2]) * 60)}. Para segurar por mais tempo, aumente "Descartar oferta que esperou mais de" em Preservação por grupo e canal.`
    }
    return 'Essa oferta esperou tempo demais na fila desse destino e foi descartada. O limite de espera fica em Preservação por grupo e canal.'
  }
  if (errorMsg.startsWith('skip:decrypt_failed')) return 'O WhatsApp não conseguiu decifrar essa mensagem na sua ponta. Costuma ser pontual.'
  if (errorMsg.startsWith('skip:incoming_error')) {
    const detail = errorMsg.slice('skip:incoming_error'.length).replace(/^:/, '').trim()
    return detail
      ? `Tivemos um erro ao processar essa mensagem antes de enviar. Detalhe técnico: ${detail}`
      : 'Tivemos um erro ao processar essa mensagem antes de enviar.'
  }
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
  // 'info': notificação sobre um envio que ocorreu com sucesso em
  // paralelo/depois (ex.: warning:ml_vitrine_fallback_used) — NUNCA rotular
  // como "ignorado", que contradiz o envio real (RCA 2026-07-13).
  info: { cls: 'is-info', label: 'aviso' },
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
