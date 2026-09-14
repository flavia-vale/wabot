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
//
//   starved — nem chegou nada, nem falhou nada, por muito mais tempo que a
//             janela, numa conta que TEM fonte monitorada. Alarme fraco:
//             pode ser fonte parada de verdade.
//   quiet   — nada chegou e nada falhou dentro da janela. NÃO é alarme
//             (madrugada, fonte parada). Silêncio sem evidência de problema
//             nunca vira aviso — alarme falso recorrente treina a pessoa a
//             ignorar justamente este alerta.
//
// RCA 2026-09-14 (viviloppes@gmail.com) — A CEGUEIRA QUE CAI A CADA 50 MINUTOS.
// A conta dela passou DOIS DIAS sem receber uma única mensagem (de ~1.100
// espelhamentos/dia para zero) e NENHUMA das redes de segurança acusou:
// `ops_wa_reception_blind` nunca saiu, a auto-cura nunca rodou, o vigia de
// silêncio nunca rodou, e o painel mostrou "conectado" o tempo todo.
//
// O motivo é aritmético, e vale para qualquer conta nesse estado: TUDO aqui era
// medido a partir da CONEXÃO ATUAL, e a conexão dela reiniciava a cada ~50min
// (queda 500 com `stuckMsg:true`, 29× em 24h). Com os defaults:
//
//   - minutos 0-20 de cada conexão: carência -> devolve `ok`, aconteça o que
//     acontecer. É exatamente quando a fila offline drena e TODAS as falhas de
//     decrypt acontecem (`offline:"1"` nos retry receipts dela);
//   - o contador de falhas tem janela de 10min: no minuto 20, quando o
//     julgamento começa, a rajada dos minutos 0-2 já foi podada -> zero falhas
//     -> nunca `blind`;
//   - `starved` exige 120min de conexão; a dela morria aos ~50 -> nunca chegava.
//
// Ou seja: a sessão que cai com frequência é justamente a que nenhum
// classificador consegue julgar. Quanto pior o estado, mais invisível ele fica.
//
// A correção é medir a cegueira num relógio que NÃO reseta na reconexão:
// `observedSinceMs` (última aceitação, ou o boot do worker) mais contadores
// cumulativos zerados só quando uma mensagem é de fato aceita
// (`failuresSinceLastAccepted` / `stableDropsSinceLastAccepted`) — o mesmo
// idioma de `chatScopeIgnoredSinceLastAccepted`. Ver `blindAcrossReconnects`.
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
// Cegueira medida ENTRE reconexões. Mais longo que um ciclo de queda/reconexão
// típico (a conta do RCA caía a cada ~50min) para que a regra nova não dispare
// em cima de uma reconexão isolada, e mais longo que a carência da conexão.
export const DEFAULT_BLIND_ACROSS_RECONNECTS_MS = 45 * 60_000
// Evidência mínima de que a conta está OCUPADA e mesmo assim não aceita nada.
// Sem evidência, silêncio continua sendo só silêncio.
export const DEFAULT_BLIND_MIN_FAILURES = 3
export const DEFAULT_BLIND_MIN_DROPS = 2

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
  // Relógio que NÃO reseta na reconexão (RCA 2026-09-14): a última aceitação
  // ou, se a conta nunca aceitou nada, o boot do worker. É o único jeito de
  // medir uma cegueira que dura dias numa sessão que vive 50 minutos.
  observedSinceMs = null,
  // Contadores CUMULATIVOS, zerados só quando uma mensagem é de fato aceita
  // (nunca por reconexão, nunca por janela de tempo).
  failuresSinceLastAccepted = 0,
  stableDropsSinceLastAccepted = 0,
  windowMs = DEFAULT_RECEPTION_WINDOW_MS,
  minFailures = DEFAULT_RECEPTION_MIN_FAILURES,
  starvedFactor = DEFAULT_RECEPTION_STARVED_FACTOR,
  blindAcrossReconnectsMs = DEFAULT_BLIND_ACROSS_RECONNECTS_MS,
  blindMinFailures = DEFAULT_BLIND_MIN_FAILURES,
  blindMinDrops = DEFAULT_BLIND_MIN_DROPS,
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

  // Cegueira ENTRE reconexões — avaliada ANTES da carência DE PROPÓSITO.
  // A carência mede a conexão atual, e é ela que escondia o caso do RCA: a
  // sessão reconectava a cada ~50min, então nunca saía da carência com as
  // falhas ainda dentro da janela curta. Aqui o relógio é `observedSinceMs`,
  // que só anda para frente quando uma mensagem é ACEITA — reconectar não
  // limpa nada. Exige evidência de atividade (falhas de decrypt ou quedas de
  // sessão estável acumuladas): silêncio sozinho nunca vira alarme.
  const blindAcross = evaluateBlindAcrossReconnects({
    now,
    observedSinceMs,
    failuresSinceLastAccepted,
    stableDropsSinceLastAccepted,
    blindAcrossReconnectsMs,
    blindMinFailures,
    blindMinDrops,
  })
  if (blindAcross) {
    return {
      ...base,
      state: RECEPTION_STATE.BLIND,
      reason: blindAcross.reason,
      silentForMs: blindAcross.silentForMs,
      blindAcrossReconnects: true,
    }
  }

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

// Decide a cegueira que atravessa reconexões. Separada para ficar testável e
// para deixar explícito que ela é fail-safe: qualquer entrada que não permita
// concluir devolve `null` (= não acusa).
function evaluateBlindAcrossReconnects({
  now,
  observedSinceMs,
  failuresSinceLastAccepted,
  stableDropsSinceLastAccepted,
  blindAcrossReconnectsMs,
  blindMinFailures,
  blindMinDrops,
}) {
  // `0` em qualquer teto desliga a regra (rollback sem redeploy).
  const limiteMs = Number(blindAcrossReconnectsMs)
  if (!Number.isFinite(limiteMs) || limiteMs <= 0) return null

  const cegaHaMs = age(now, observedSinceMs)
  if (cegaHaMs == null || cegaHaMs < limiteMs) return null

  const falhas = Math.max(0, Number(failuresSinceLastAccepted) || 0)
  const quedas = Math.max(0, Number(stableDropsSinceLastAccepted) || 0)
  const minFalhas = Number(blindMinFailures)
  const minQuedas = Number(blindMinDrops)

  // Um teto <= 0 desliga AQUELA evidência, não a regra inteira.
  const porFalha = Number.isFinite(minFalhas) && minFalhas > 0 && falhas >= minFalhas
  const porQueda = Number.isFinite(minQuedas) && minQuedas > 0 && quedas >= minQuedas
  if (!porFalha && !porQueda) return null

  return {
    silentForMs: cegaHaMs,
    reason: porFalha
      ? 'nada aceito desde antes das últimas reconexões, com mensagem chegando e falhando'
      : 'nada aceito desde antes das últimas reconexões, com a sessão caindo repetidamente',
  }
}

// Só `blind` é problema nosso comprovado. `starved` é suspeita (pode ser fonte
// parada de verdade) e entra como aviso fraco na visão admin, nunca como
// alarme automático.
export function isReceptionProblem(state) {
  return state === RECEPTION_STATE.BLIND
}
