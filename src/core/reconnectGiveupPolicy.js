// Teto de tentativas de reconexão sem sucesso.
//
// RCA 2026-08-28: três contas (`miguelferreirasilva678`, `ferreiraclenio900`,
// `martinsvirginioes`) somaram 281 das ~380 quedas de 12h — 94, 94 e 93
// tentativas, com ZERO conexões bem-sucedidas. Nenhuma delas com mensagem
// travada: eram sessões que tentavam a cada ~8min e o WhatsApp nunca aceitava.
//
// O gatilho foi a correção da ressurreição (RCA 2026-08-27): antes essas
// sessões morriam e ficavam quietas; depois passaram a ser levantadas de volta
// e a martelar. Medido: de 0,6-1,9 quedas/h para 7-8/h nas três. Trocar "morta
// em silêncio" por "loop de reconexão" é pior — reconexão repetida é o padrão
// que o WhatsApp associa a robô, e o preço é chip restringido.
//
// A resposta NÃO é parar de tentar (isso quebraria a promessa de robô 24h e
// contraria a política de alta disponibilidade do AGENTS.md). É desacelerar, e
// só desistir quando não há o que reconectar:
//
//   - sessão que JÁ conectou e caiu → depois de N falhas seguidas, passa a
//     tentar devagar. Queda de rede ou do WhatsApp continua se recuperando
//     sozinha; a exposição cai ~75%.
//   - sessão que NUNCA conectou nesta credencial → para. Sem credencial válida
//     o WhatsApp nunca vai aceitar; insistir é só risco de ban, e o que
//     resolve é a cliente ler o QR.
//
// Qualquer conexão bem-sucedida zera tudo.
//
// Puro: sem I/O, sem relógio implícito.

export const RETRY_ACTION = {
  RETRY: 'retry',
  SLOW: 'slow',
  STOP: 'stop',
}

// 12 tentativas ≈ 1h no ritmo atual (backoff satura em 5min): cobre com folga
// queda de rede e instabilidade do WhatsApp antes de desacelerar.
export const DEFAULT_GIVEUP_ATTEMPTS = 12
// 15min (e não 30): a política de alta disponibilidade do projeto prefere
// indisponibilidade curta, e 15min já corta 75% das tentativas.
export const DEFAULT_SLOW_INTERVAL_MS = 15 * 60_000
// Pareamento que não completa não melhora com insistência.
export const DEFAULT_NEVER_CONNECTED_MAX = 10

export function decideRetryPace({
  consecutiveFailures = 0,
  everConnected = true,
  baseDelayMs = 0,
  giveupAttempts = DEFAULT_GIVEUP_ATTEMPTS,
  slowIntervalMs = DEFAULT_SLOW_INTERVAL_MS,
  neverConnectedMax = DEFAULT_NEVER_CONNECTED_MAX,
} = {}) {
  const falhas = Math.max(0, Number(consecutiveFailures) || 0)
  const base = Math.max(0, Number(baseDelayMs) || 0)

  // Nunca conectou nesta credencial: o único caminho é a cliente ler o QR.
  const tetoSemConexao = Number(neverConnectedMax)
  if (!everConnected && Number.isFinite(tetoSemConexao) && tetoSemConexao > 0 && falhas >= tetoSemConexao) {
    return { action: RETRY_ACTION.STOP, delayMs: null, reason: 'nunca conectou e o limite de tentativas acabou' }
  }

  const teto = Number(giveupAttempts)
  // `0` desliga a desaceleração (escape hatch).
  if (!Number.isFinite(teto) || teto <= 0 || falhas < teto) {
    return { action: RETRY_ACTION.RETRY, delayMs: base, reason: 'dentro do orçamento normal de tentativas' }
  }

  const lento = Math.max(base, Number(slowIntervalMs) || 0)
  return { action: RETRY_ACTION.SLOW, delayMs: lento, reason: 'muitas tentativas seguidas sem conectar' }
}
