// Resolução do timeout duro em volta de cada sock.sendMessage/relayMessage.
// Módulo puro/testável para não tocar a lógica do bot-worker (PROTECTED_CORE).
//
// Política: 1ª tentativa paciente (gera link preview, mídia hospedada, rede
// pode oscilar), demais rápidas para liberar a fila. Override uniforme opcional
// via env SEND_MESSAGE_TIMEOUT_MS.

export const DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS = [90_000, 60_000, 45_000]
const MIN_TIMEOUT_MS = 5_000

// Resolve o override uniforme opcional.
//   vazio / 0 / <=0 / não-numérico  -> null  (usa o array por tentativa)
//   > 0                             -> clamp em MIN_TIMEOUT_MS
//
// Corrige o bug histórico `Math.max(5000, envNumber(...,0)) || null`, que
// devolvia 5000 SEMPRE (mesmo sem env), travando TODO envio em 5s e deixando o
// array [90,60,45]s como código morto.
export function resolveSendTimeoutOverrideMs(rawEnvValue) {
  const n = Number(rawEnvValue)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.max(MIN_TIMEOUT_MS, n)
}

export function resolveSendTimeoutMs(attempt, { overrideMs = null, byAttempt = DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS } = {}) {
  if (overrideMs) return overrideMs
  const list = byAttempt?.length ? byAttempt : DEFAULT_SEND_TIMEOUT_BY_ATTEMPT_MS
  const idx = Math.max(0, Math.min(list.length - 1, (attempt || 1) - 1))
  return list[idx]
}
