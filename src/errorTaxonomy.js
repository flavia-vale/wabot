// Taxonomia canônica de errorMsg gravada em MessageLog.
//
// Toda gravação final em MessageLog.errorMsg passa por classifyError() para
// produzir um prefixo previsível (`skip:*`, `timeout:*`, `error:*`). O painel
// e o endpoint /api/logs/summary leem esses prefixos via categorizeErrorMsg()
// para agregar contagens e renderizar badges em linguagem de cliente.
//
// Não remover prefixos existentes — dados históricos no banco usam os mesmos
// rótulos `skip:dedup_recent_link`, `skip:title_mismatch`, etc.

export const ERROR_CATEGORIES = Object.freeze({
  DEDUP: 'dedup',
  CONFIG_BLOCK: 'config_block',
  TIMEOUT: 'timeout',
  CHANNEL_FORBIDDEN: 'channel_forbidden',
  CHANNEL_THROTTLED: 'channel_throttled',
  QUEUE_FULL: 'queue_full',
  WORKER_RESTART: 'worker_restart',
  DECRYPT: 'decrypt',
  BAILEYS: 'baileys',
  INCOMING_ERROR: 'incoming_error',
  CONVERSION: 'conversion',
  CREDENTIAL_EXPIRED: 'credential_expired',
  OTHER: 'other',
  UNKNOWN: 'unknown',
})

// Mapeia uma exceção ou string crua para um errorMsg canônico.
// `context.kind` permite ao chamador indicar a origem semântica quando ela
// não dá pra deduzir só do erro (ex: rejeição de fila cheia não é exception).
export function classifyError(err, context = {}) {
  const raw = typeof err === 'string' ? err : (err?.message || '')
  const code = typeof err === 'object' && err ? err.code : null

  if (context.kind === 'queue_full') return 'error:queue_full'
  if (context.kind === 'worker_restart') return 'error:worker_restart'
  if (context.kind === 'channel_forbidden') return 'error:channel_forbidden'
  if (context.kind === 'send_stuck') return 'timeout:send:stuck'
  // Usuário clicou "Limpar ofertas da fila" no painel de Envios para destravar
  // mensagens presas em 'queued'/'sending'. É decisão de não enviar (skip
  // benigno), não uma falha real — pinta cinza, não vermelho.
  if (context.kind === 'queue_cleared') return 'skip:queue_cleared'

  if (code === 'SEND_MESSAGE_TIMEOUT') {
    const dest = context.destJid ? `:${context.destJid}` : ''
    return `timeout:send${dest}`
  }
  if (code === 'CHANNEL_THROTTLED' || /Canal throttled/i.test(raw)) {
    return 'error:channel_throttled'
  }

  // Timeout interno da incomingQueue: messageQueue.js lança `timeout ${ms}ms: <label>`.
  if (/^timeout \d+ms:/i.test(raw)) return 'timeout:incoming'

  // Erros de decrypt de Signal/libsignal — mantidos como skip (decisão de não enviar).
  if (/Bad MAC|MessageCounterError|Key used already or never filled/i.test(raw)) {
    return `skip:decrypt_failed:${raw.slice(0, 80)}`
  }

  // Erros tipados do Baileys (Boom) trazem output.statusCode.
  const statusCode = err && typeof err === 'object' ? err?.output?.statusCode : null
  if (statusCode) return `error:baileys:${statusCode}`

  if (context.kind === 'incoming') {
    return `skip:incoming_error:${raw.slice(0, 80) || 'unknown'}`
  }

  const detail = raw ? raw.split('\n')[0].slice(0, 120) : 'unknown'
  return `error:other:${detail}`
}

// Categoriza um errorMsg (canônico ou histórico) para agregação no painel.
// Tolerante a strings legadas livres — devolve UNKNOWN em vez de quebrar.
export function categorizeErrorMsg(errorMsg) {
  if (!errorMsg || typeof errorMsg !== 'string') return ERROR_CATEGORIES.UNKNOWN

  if (errorMsg.startsWith('skip:dedup')) return ERROR_CATEGORIES.DEDUP
  if (errorMsg.startsWith('skip:blocked_keyword')) return ERROR_CATEGORIES.CONFIG_BLOCK
  if (errorMsg.startsWith('skip:title_mismatch')) return ERROR_CATEGORIES.CONFIG_BLOCK
  if (errorMsg.startsWith('skip:text_too_large')) return ERROR_CATEGORIES.CONFIG_BLOCK
  // Vitrine/perfil de terceiro do ML (link /social/) sem vitrine própria
  // cadastrada — bloqueio de configuração acionável (cadastrar em IDs de
  // afiliada → Mercado Livre), não falha de credencial/SSID. Já coberto pelo
  // catch-all `skip:` abaixo; branch explícito só para documentar o motivo
  // canônico (feature 007-ml-vitrine-fallback-expired).
  if (errorMsg.startsWith('skip:ml_vitrine_missing')) return ERROR_CATEGORIES.CONFIG_BLOCK
  // Descarte por idade na fila (queueMaxAgeMin da Preservação do destino). É
  // decisão de configuração, não falha de envio — cai em CONFIG_BLOCK como os
  // demais `skip:`. Branch explícito só para documentar o motivo canônico.
  if (errorMsg.startsWith('skip:queue_expired')) return ERROR_CATEGORIES.CONFIG_BLOCK
  // Fora do horário de envio do destino e sem chance de sair antes do limite
  // de espera (RCA 2026-09-24) — descartada na hora, decisão de configuração.
  if (errorMsg.startsWith('skip:outside_send_window')) return ERROR_CATEGORIES.CONFIG_BLOCK
  // Destino (ou a própria origem) deixou de estar vinculado enquanto o envio
  // esperava na fila — decisão de configuração da cliente, não falha de envio.
  if (errorMsg.startsWith('skip:dest_unlinked')) return ERROR_CATEGORIES.CONFIG_BLOCK
  if (errorMsg.startsWith('skip:source_unlinked')) return ERROR_CATEGORIES.CONFIG_BLOCK
  if (errorMsg.startsWith('skip:decrypt_failed')) return ERROR_CATEGORIES.DECRYPT
  if (errorMsg.startsWith('skip:incoming_error')) return ERROR_CATEGORIES.INCOMING_ERROR
  if (errorMsg.startsWith('warning:amazon_cookies_expired')) return ERROR_CATEGORIES.CREDENTIAL_EXPIRED
  if (errorMsg.startsWith('warning:')) return ERROR_CATEGORIES.CREDENTIAL_EXPIRED
  if (errorMsg.startsWith('skip:')) return ERROR_CATEGORIES.CONFIG_BLOCK

  if (errorMsg.startsWith('timeout:')) return ERROR_CATEGORIES.TIMEOUT

  if (errorMsg.startsWith('error:channel_forbidden')) return ERROR_CATEGORIES.CHANNEL_FORBIDDEN
  if (errorMsg.startsWith('error:channel_throttled')) return ERROR_CATEGORIES.CHANNEL_THROTTLED
  if (errorMsg.startsWith('error:queue_full')) return ERROR_CATEGORIES.QUEUE_FULL
  if (errorMsg.startsWith('error:worker_restart')) return ERROR_CATEGORIES.WORKER_RESTART
  if (errorMsg.startsWith('error:baileys')) return ERROR_CATEGORIES.BAILEYS
  if (errorMsg.startsWith('error:conversion')) return ERROR_CATEGORIES.CONVERSION
  if (errorMsg.startsWith('error:')) return ERROR_CATEGORIES.OTHER

  return ERROR_CATEGORIES.UNKNOWN
}

// True quando o `errorMsg` representa proteção/configuração do usuário, não falha real.
// Usado pelo painel para pintar a linha em cinza em vez de vermelho.
export function isBenignSkip(errorMsg) {
  const category = categorizeErrorMsg(errorMsg)
  return (
    category === ERROR_CATEGORIES.DEDUP ||
    category === ERROR_CATEGORIES.CONFIG_BLOCK
  )
}
