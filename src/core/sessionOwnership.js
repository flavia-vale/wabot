// "Quem resolve esta desconexão?" — a pergunta que o admin não sabia responder.
//
// RCA 2026-08-26: a dona do produto notou clientes desconectados cujo último
// evento NÃO era "desligou pelo painel", e não tinha como saber se o robô ia
// voltar sozinho ou se a pessoa precisava agir. A medição confirmou que era
// caso grande: de ~68 contas ativas desconectadas, só 3 tinham desligado de
// propósito, ~24 precisavam de QR novo e ~23 estavam simplesmente PARADAS,
// sem nenhum robô tentando (13 workers no ar para 13 sessões conectadas).
//
// A informação já existia no banco, espalhada em três campos que ninguém
// cruzava. Aqui ela vira uma resposta só.
//
// Puro: sem I/O, sem relógio implícito.

export const SESSION_OWNER = {
  // Está tudo certo.
  CONNECTED: 'connected',
  // O robô está tentando sozinho — ninguém precisa fazer nada.
  ROBOT: 'robo',
  // Só volta com a cliente lendo o QR (desvinculou no celular, auth apagado).
  CLIENT: 'cliente',
  // A cliente desligou de propósito.
  CLIENT_STOPPED: 'cliente_desligou',
  // O WhatsApp recusou o número — risco de restrição/ban, caso para olhar.
  BLOCKED: 'bloqueio',
  // NINGUÉM está tentando: sem robô no ar e sem reconexão agendada. É o caso
  // que passava despercebido, e o único em que um clique nosso resolve.
  NOBODY: 'ninguem',
}

// Códigos que exigem ação da cliente. 401 = desvinculou o aparelho no celular
// (a credencial é apagada); 403 = o WhatsApp recusou o número.
const CLIENT_ACTION_CODES = new Set(['401'])
const BLOCKED_CODES = new Set(['403'])
const CLIENT_ACTION_EVENTS = new Set(['disconnect_terminal', 'auth_reset'])
const STOP_EVENTS = new Set(['manual_stop_requested'])

export const DEFAULT_HEARTBEAT_STALE_MS = 5 * 60_000

export function resolveSessionOwner({
  status = 'disconnected',
  lifecycle = null,
  lastDisconnectCode = null,
  lastEventType = null,
  workerRunning = null,
  lastHeartbeatAt = null,
  now = Date.now(),
  staleAfterMs = DEFAULT_HEARTBEAT_STALE_MS,
} = {}) {
  if (status === 'connected') return { owner: SESSION_OWNER.CONNECTED, canAdminRetry: false, reason: 'conectado' }

  const code = lastDisconnectCode == null ? null : String(lastDisconnectCode)

  if (STOP_EVENTS.has(String(lastEventType)) || lifecycle === 'stopped_by_user') {
    return { owner: SESSION_OWNER.CLIENT_STOPPED, canAdminRetry: true, reason: 'a cliente desligou pelo painel' }
  }
  if (BLOCKED_CODES.has(code)) {
    return { owner: SESSION_OWNER.BLOCKED, canAdminRetry: false, reason: 'o WhatsApp recusou o número' }
  }
  // Credencial apagada: reconectar daqui só geraria um QR que apenas a cliente
  // pode ler no celular dela. Prometer que o botão resolve seria mentira.
  if (CLIENT_ACTION_CODES.has(code) || CLIENT_ACTION_EVENTS.has(String(lastEventType))) {
    return { owner: SESSION_OWNER.CLIENT, canAdminRetry: false, reason: 'precisa que a cliente leia o QR de novo' }
  }

  const heartbeatMs = lastHeartbeatAt == null ? null : new Date(lastHeartbeatAt).getTime()
  const heartbeatFresh = Number.isFinite(heartbeatMs) && (now - heartbeatMs) <= Math.max(60_000, staleAfterMs)

  // Robô vivo e batendo ponto: está tentando sozinho.
  if (workerRunning === true && heartbeatFresh) {
    return { owner: SESSION_OWNER.ROBOT, canAdminRetry: false, reason: 'o robô está tentando sozinho' }
  }
  // Sem saber se o robô está de pé, um heartbeat fresco ainda indica que tem
  // alguém tentando — não oferecemos o clique para não atropelar.
  if (workerRunning == null && heartbeatFresh) {
    return { owner: SESSION_OWNER.ROBOT, canAdminRetry: false, reason: 'o robô está tentando sozinho' }
  }

  return { owner: SESSION_OWNER.NOBODY, canAdminRetry: true, reason: 'parada, sem nenhum robô tentando' }
}

// Rótulo curto para a tela do admin (não vai para a cliente).
export const SESSION_OWNER_LABEL = {
  [SESSION_OWNER.CONNECTED]: 'conectado',
  [SESSION_OWNER.ROBOT]: 'o robô está tentando',
  [SESSION_OWNER.CLIENT]: 'precisa da cliente (QR)',
  [SESSION_OWNER.CLIENT_STOPPED]: 'ela desligou',
  [SESSION_OWNER.BLOCKED]: 'número recusado pelo WhatsApp',
  [SESSION_OWNER.NOBODY]: 'parada, ninguém tentando',
}
