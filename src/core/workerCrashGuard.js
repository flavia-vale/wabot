// Guardas de processo do bot-worker.
//
// Um throw ASSÍNCRONO benigno do Baileys (ex.: "Connection Closed"/428 disparado
// por `sendRetryRequest` → `sendPeerDataOperationMessage` num socket que já
// fechou) NÃO pode derrubar o processo inteiro do worker. Se derrubar, a
// reconexão automática agendada no handler `connection.update`
// (`setTimeout(startBot, 5s)` em bot-worker.js) nunca roda — o processo morre,
// sai do mapa do sessionCore com `status='disconnected'`, e aí nem o resume de
// sessões persistidas (filtra `connected/connecting`) nem o monitor de heartbeat
// (precisa da entry no mapa) o ressuscitam. Sintoma: "estava conectado, caiu e
// ficou offline até religar manual" (incidente 2026-06: conflito 440 `replaced`
// → cascata de 428 `Connection Closed` não tratada → worker crashou).
//
// Estratégia: erros de nível de conexão/stream (Boom com statusCode, ou
// mensagens conhecidas de socket fechado) são RECUPERÁVEIS — logamos e mantemos
// o processo vivo para o ciclo `connection.update` reconectar sozinho. Qualquer
// outro erro é tratado como fatal (estado possivelmente corrompido) e delega ao
// `onFatal` (tipicamente `process.exit(1)`), deixando o restart para o
// supervisor/monitor de saúde a partir de um estado limpo.

const RECOVERABLE_MESSAGE_FRAGMENTS = [
  'connection closed',
  'connection terminated',
  'timed out',
  'stream errored',
  'websocket',
  'socket',
]

export function isRecoverableWorkerError(err) {
  if (!err) return false
  // Boom (@hapi/boom) marca erros de protocolo/conexão do Baileys.
  if (err.isBoom || err?.output?.statusCode != null) return true
  const message = String(err?.message ?? err ?? '').toLowerCase()
  return RECOVERABLE_MESSAGE_FRAGMENTS.some((frag) => message.includes(frag))
}

export function installWorkerCrashGuards({ logger, onFatal } = {}) {
  const log = logger ?? console
  const handle = (kind) => (err) => {
    if (isRecoverableWorkerError(err)) {
      log.warn?.(
        { kind, err: err?.message, statusCode: err?.output?.statusCode },
        'Erro de conexão não tratado no worker — mantendo processo vivo para reconexão automática',
      )
      return
    }
    log.error?.(
      { kind, err: err?.message, stack: err?.stack },
      'Erro fatal não tratado no worker — encerrando para restart limpo',
    )
    if (typeof onFatal === 'function') onFatal(err)
  }
  process.on('uncaughtException', handle('uncaughtException'))
  process.on('unhandledRejection', handle('unhandledRejection'))
}
