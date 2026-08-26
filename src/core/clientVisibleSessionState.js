// O que a CLIENTE vê sobre a conexão — que não é a mesma coisa que o estado
// cru da sessão.
//
// Pedido da dona do produto (2026-08-26), a partir da medição de produção que
// mostrou ~20 quedas/hora na frota, quase todas recuperadas sozinhas em
// segundos: expor cada piscada gera aflição, chamado no suporte e — pior —
// re-pareamento desnecessário, que é justamente a ação que PIORA o estado
// (logo após reconectar há rajada esperada de Bad MAC enquanto as chaves
// re-sincronizam).
//
// Regra: **nós vemos tudo, ela vê o que precisa decidir.**
//
// Três limites impedem que isso vire mentira:
//   1. Situação que exige ação dela (deslogada, bloqueio do WhatsApp, auth
//      apagado, parada pedida) NUNCA passa pela carência — aparece na hora.
//   2. A carência é limitada pelo teto de reconexão presa
//      (WA_HEARTBEAT_MAX_RECONNECTING_MS): nunca escondemos indefinidamente.
//   3. Sem saber há quanto tempo caiu, não escondemos nada (fail-open para a
//      verdade).
//
// Revisa, com motivo declarado, a decisão de 2026-07 registrada no AGENTS.md
// ("status disconnected sempre renderiza Desconectado"). O que aquela decisão
// protegia — não esconder loop de reconexão — segue protegido pelos limites
// 1 e 2; o que muda é só a piscada de segundos.
//
// Puro: sem I/O, sem relógio implícito.

export const CLIENT_SESSION_STATE = {
  CONNECTED: 'connected',
  RECOVERING: 'recovering',
  NOT_RECEIVING: 'not_receiving',
  CONNECTING: 'connecting',
  STOPPED: 'stopped',
  ACTION_REQUIRED: 'action_required',
}

export const DEFAULT_CLIENT_GRACE_MS = 3 * 60_000

// Códigos de close que a cliente PRECISA resolver — nenhum deles espera
// carência. 401 = deslogada no celular; 403 = WhatsApp bloqueou o número.
const ACTION_REQUIRED_CODES = new Set(['401', '403'])

export function resolveClientVisibleState({
  running = false,
  status = 'disconnected',
  lifecycle = null,
  lastDisconnectCode = null,
  disconnectedForMs = null,
  receptionState = null,
  awaitingUserAction = false,
  graceMs = DEFAULT_CLIENT_GRACE_MS,
  maxReconnectingMs = null,
} = {}) {
  const code = lastDisconnectCode == null ? null : String(lastDisconnectCode)
  const connected = status === 'connected'

  // Limite 2: a carência nunca pode passar do teto de reconexão presa.
  const cap = Number(maxReconnectingMs)
  const effectiveGraceMs = Math.max(0, Number.isFinite(cap) && cap > 0
    ? Math.min(Number(graceMs) || 0, cap)
    : (Number(graceMs) || 0))

  if (connected) {
    if (receptionState === 'blind') {
      return { state: CLIENT_SESSION_STATE.NOT_RECEIVING, needsAction: false, hiddenByGrace: false }
    }
    return { state: CLIENT_SESSION_STATE.CONNECTED, needsAction: false, hiddenByGrace: false }
  }

  // Limite 1: nada abaixo espera carência.
  if (lifecycle === 'stopped_by_user') {
    return { state: CLIENT_SESSION_STATE.STOPPED, needsAction: true, hiddenByGrace: false }
  }
  if (code && ACTION_REQUIRED_CODES.has(code)) {
    return { state: CLIENT_SESSION_STATE.ACTION_REQUIRED, needsAction: true, hiddenByGrace: false, reason: code === '403' ? 'bloqueio' : 'deslogado' }
  }
  // Pareamento em curso (QR/código na tela) é o fluxo normal de conectar —
  // não é queda e não entra em carência.
  if (awaitingUserAction || lifecycle === 'authenticating') {
    return { state: CLIENT_SESSION_STATE.CONNECTING, needsAction: false, hiddenByGrace: false }
  }

  const recovering = lifecycle === 'reconnecting' || (running && status === 'connecting')
  if (recovering) {
    // Limite 3: sem saber há quanto tempo caiu, mostra a verdade.
    // `Number(null)` é 0 — tratar ausência como "caiu agora" esconderia
    // justamente a queda que não conseguimos medir.
    const forMs = disconnectedForMs == null || disconnectedForMs === '' ? null : Number(disconnectedForMs)
    if (forMs != null && Number.isFinite(forMs) && forMs >= 0 && forMs < effectiveGraceMs) {
      return { state: CLIENT_SESSION_STATE.CONNECTED, needsAction: false, hiddenByGrace: true }
    }
    return { state: CLIENT_SESSION_STATE.RECOVERING, needsAction: false, hiddenByGrace: false }
  }

  return { state: CLIENT_SESSION_STATE.ACTION_REQUIRED, needsAction: true, hiddenByGrace: false }
}
