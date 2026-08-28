// Saúde de RECEPÇÃO da sessão WhatsApp — "está chegando mensagem?", que é
// diferente de "o processo está vivo?".
//
// RCA 2026-08 (contas cynthiatceles@ e julianepumuceno16@): o painel mostrava
// verde, o heartbeat atualizava, o socket estava aberto — e o espelhamento
// estava parado havia horas. O heartbeat prova liveness, não recepção. A
// cliente descobriu antes de nós, duas vezes.
//
// Estados (nesta ordem de prioridade):
//   offline — sem conexão; o status normal de desconectado já cobre o aviso.
//   ok      — chegou mensagem ACEITA dentro da janela, ou a conexão é recente
//             demais para julgar (carência).
//   blind   — está chegando coisa e FALHANDO (falhas de decrypt / pedidos de
//             reenvio acima do mínimo) e NADA foi aceito na janela. É o quadro
//             da Cynthia: conectado, ocupado, e sem espelhar nada.
//   starved — nem chegou nada, nem falhou nada, por muito mais tempo que a
//             janela, numa conta que TEM fonte monitorada. Alarme fraco:
//             pode ser fonte parada de verdade.
//   quiet   — nada chegou e nada falhou dentro da janela. NÃO é alarme
//             (madrugada, fonte parada). Silêncio sem evidência de problema
//             nunca vira aviso — alarme falso recorrente treina a pessoa a
//             ignorar justamente este alerta.
//
// Puro: sem I/O, sem relógio implícito.

export const RECEPTION_STATE = {
  OFFLINE: 'offline',
  OK: 'ok',
  QUIET: 'quiet',
  BLIND: 'blind',
  STARVED: 'starved',
}

export const DEFAULT_RECEPTION_WINDOW_MS = 20 * 60_000
export const DEFAULT_RECEPTION_MIN_FAILURES = 3
export const DEFAULT_RECEPTION_STARVED_FACTOR = 6

function age(now, at) {
  if (!Number.isFinite(at) || at <= 0) return null
  return Math.max(0, now - at)
}

export function computeReceptionState({
  now = Date.now(),
  connected = false,
  connectedSinceMs = null,
  lastUpsertAtMs = null,
  lastAcceptedAtMs = null,
  failuresInWindow = 0,
  hasMonitoredSources = false,
  // Fila de entrada: quantos jobs esperando e quando um saiu pela última vez.
  // RCA 2026-08-28: a mensagem era ACEITA (e o marcador de recepção ficava
  // fresco) mas a fila da origem estava travada e nada era processado — o
  // alerta via tudo verde enquanto a cliente ficava sem oferta nenhuma.
  incomingPending = 0,
  lastProcessedAtMs = null,
  windowMs = DEFAULT_RECEPTION_WINDOW_MS,
  minFailures = DEFAULT_RECEPTION_MIN_FAILURES,
  starvedFactor = DEFAULT_RECEPTION_STARVED_FACTOR,
} = {}) {
  const safeWindowMs = Math.max(60_000, Number(windowMs) || DEFAULT_RECEPTION_WINDOW_MS)
  const connectedForMs = age(now, connectedSinceMs)
  const acceptedAgeMs = age(now, lastAcceptedAtMs)
  const upsertAgeMs = age(now, lastUpsertAtMs)
  const base = {
    windowMs: safeWindowMs,
    connectedForMs,
    lastAcceptedAgeMs: acceptedAgeMs,
    lastUpsertAgeMs: upsertAgeMs,
    failuresInWindow: Math.max(0, Number(failuresInWindow) || 0),
    silentForMs: null,
  }

  if (!connected) return { ...base, state: RECEPTION_STATE.OFFLINE, reason: 'sem conexão' }

  // Carência: sessão recém-conectada ainda não teve tempo de receber nada.
  // Julgar aqui produziria alarme falso a cada reconexão — e elas são muitas.
  if (connectedForMs != null && connectedForMs < safeWindowMs) {
    return { ...base, state: RECEPTION_STATE.OK, reason: 'conexão recente' }
  }

  // Fila de entrada parada: tem mensagem esperando e nada sai dela há mais que
  // a janela. Vem ANTES do 'ok' por aceitação, porque é justamente o caso em
  // que a mensagem é aceita e nunca processada.
  const processedAgeMs = age(now, lastProcessedAtMs)
  const pendentes = Math.max(0, Number(incomingPending) || 0)
  if (pendentes > 0 && processedAgeMs != null && processedAgeMs > safeWindowMs) {
    return {
      ...base,
      state: RECEPTION_STATE.BLIND,
      reason: 'fila de entrada parada: mensagem esperando e nada sendo processado',
      silentForMs: processedAgeMs,
    }
  }

  if (acceptedAgeMs != null && acceptedAgeMs <= safeWindowMs) {
    return { ...base, state: RECEPTION_STATE.OK, reason: 'mensagem aceita na janela', silentForMs: acceptedAgeMs }
  }

  // Quanto tempo faz que nada útil entra. Sem nenhuma aceitação registrada,
  // conta desde a conexão (não desde o boot do processo).
  const silentForMs = acceptedAgeMs ?? connectedForMs ?? null

  if (base.failuresInWindow >= Math.max(1, Number(minFailures) || DEFAULT_RECEPTION_MIN_FAILURES)) {
    return {
      ...base,
      state: RECEPTION_STATE.BLIND,
      reason: 'chegando e falhando, nada aceito',
      silentForMs,
    }
  }

  const starvedAfterMs = safeWindowMs * Math.max(2, Number(starvedFactor) || DEFAULT_RECEPTION_STARVED_FACTOR)
  const nothingArrivedForMs = upsertAgeMs ?? connectedForMs
  if (hasMonitoredSources && nothingArrivedForMs != null && nothingArrivedForMs >= starvedAfterMs) {
    return { ...base, state: RECEPTION_STATE.STARVED, reason: 'nenhuma mensagem chegando há muito tempo', silentForMs }
  }

  return { ...base, state: RECEPTION_STATE.QUIET, reason: 'sem tráfego e sem falha', silentForMs }
}

// Só `blind` é problema nosso comprovado. `starved` é suspeita (pode ser fonte
// parada de verdade) e entra como aviso fraco na visão admin, nunca como
// alarme automático.
export function isReceptionProblem(state) {
  return state === RECEPTION_STATE.BLIND
}
