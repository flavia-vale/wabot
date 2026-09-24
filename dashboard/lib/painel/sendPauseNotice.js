// Aviso "o robô está esperando o Anti-banimento" — a regra mora em
// src/domain/painel/sendPauseStatus.js (pura), compartilhada com a rota
// `GET /api/logs/send-pause`, para painel e API dizerem a mesma coisa.
// Este arquivo só re-exporta para o app Next.
export {
  ANTI_BAN_SETTINGS_HREF,
  SEND_PAUSE_KIND,
  buildSendPauseNotice,
  classifyDeferMessage,
  describeSendPause,
  summarizeQueuedByKind,
} from '../../../src/domain/painel/sendPauseStatus.js'
