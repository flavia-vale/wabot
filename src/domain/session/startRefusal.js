import { shouldHandleUserOnShard } from '../../supervisor/sharding.js'

// Por que este módulo existe (RCA 2026-09-07)
// ------------------------------------------
// O servidor recusa ligar o robô por motivos DIFERENTES — teto de robôs
// ligados ao mesmo tempo, conta apontada para um servidor que não a atende, ou
// uma vaga presa por um robô que não terminou de desligar — e todos chegavam à
// cliente como a MESMA frase: "Nosso servidor está no limite de robôs ligados".
// Uma cliente reportou essa mensagem com o servidor comprovadamente fora do
// teto, e não havia como saber pela tela (nem pelo log da API) qual das causas
// tinha sido — o diagnóstico exigia entrar no VPS e ler o log do supervisor.
//
// A classificação é feita AQUI, do lado da API, sem mudar o contrato do
// supervisor (`src/supervisor/protocol.js` é [PROTECTED_CORE] e, em modo
// `remote`, o supervisor NÃO é reiniciado no deploy — uma mudança de protocolo
// ficaria dormente e as duas pontas divergiriam). A API tem tudo de que
// precisa: o `.env` é o MESMO dos dois processos (logo conhece o teto e a
// configuração de servidor) e `listRunningBots()` já é um comando existente.
//
// Regra de ouro: **na dúvida, nunca afirmar que é o teto**. Dizer "estamos
// lotados" para quem parou por outro motivo manda a cliente esperar por uma
// vaga que já existe — e some com o defeito real.

export const START_REFUSAL_CAPACITY = 'capacity'
export const START_REFUSAL_MISPLACED = 'session_misplaced'
export const START_REFUSAL_UNKNOWN = 'unknown'

const MESSAGES = {
  [START_REFUSAL_CAPACITY]: {
    code: 'WA_CAPACITY_LIMIT',
    error: 'Nosso servidor está no limite de robôs ligados ao mesmo tempo. Nossa equipe já foi avisada — tente de novo em alguns minutos.',
  },
  // Linguagem leiga obrigatória: nada de "shard", "supervisor" ou "worker".
  // E o texto NÃO pede para tentar de novo: tentar não resolve, e repetir a
  // tentativa é exatamente o que a cliente fez sete vezes no relato original.
  [START_REFUSAL_MISPLACED]: {
    code: 'WA_SESSION_MISPLACED',
    error: 'Sua conta está apontada para um servidor que não está atendendo agora. Nossa equipe já foi avisada — não adianta tentar de novo, vamos resolver isso por aqui.',
  },
  [START_REFUSAL_UNKNOWN]: {
    code: 'WA_START_REFUSED',
    error: 'Não conseguimos ligar seu robô agora. Nossa equipe já foi avisada — espere um minuto e tente de novo.',
  },
}

function toCount(value) {
  // `null`/`undefined`/'' viram `null`, NUNCA 0 — `Number(null)` é 0 e isso
  // faria "não consegui medir" passar por "zero robôs ligados".
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

/**
 * Descobre POR QUE o servidor recusou ligar o robô.
 *
 * Puro: recebe os números medidos, não mede nada. `runningCount` vem de
 * `listRunningBots()` (pode ser `null` quando a consulta falhou) e
 * `maxSessions` do mesmo `MAX_SESSIONS_PER_PROCESS` que o supervisor lê.
 *
 * Ordem das checagens: servidor errado ANTES do teto. Conta fora do servidor
 * é recusada mesmo com o servidor vazio, então concluir "teto" ali contaria a
 * história errada.
 */
export function classifyStartRefusal({ userId, shardCount, shardIndex, runningCount, maxSessions } = {}) {
  const count = toCount(shardCount) ?? 1
  const index = toCount(shardIndex) ?? 0
  const running = toCount(runningCount)
  const max = toCount(maxSessions)

  if (count > 1 && !shouldHandleUserOnShard(userId, count, index)) {
    return { reason: START_REFUSAL_MISPLACED, running, max, ...MESSAGES[START_REFUSAL_MISPLACED] }
  }
  // Sem medição confiável (consulta falhou, supervisor mudo) NÃO afirmamos
  // teto — é o mesmo fail-safe do aviso de código de acesso vencido: alarme
  // errado é pior que alarme genérico.
  if (running !== null && max !== null && running >= max) {
    return { reason: START_REFUSAL_CAPACITY, running, max, ...MESSAGES[START_REFUSAL_CAPACITY] }
  }
  return { reason: START_REFUSAL_UNKNOWN, running, max, ...MESSAGES[START_REFUSAL_UNKNOWN] }
}
