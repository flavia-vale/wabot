// Feature 017, Fatia 3 (T064) — PURO. Estado do robô único de um aplicativo,
// a partir das últimas respostas dele (FR-041). Falha de UM grupo (robô fora
// do grupo, sem permissão) não diz nada sobre o robô — só as respostas
// globais contam: sucesso, limite de ritmo, robô bloqueado, fora do ar.

export const NETWORK_HEALTH = Object.freeze({
  FUNCIONANDO: 'funcionando',
  LIMITADO: 'limitado',
  BLOQUEADO: 'bloqueado',
  INDISPONIVEL: 'indisponivel',
  CONFLITO: 'conflito',
  SEM_MEDICAO: 'sem_medicao',
})

export const HEALTH_SIGNAL = Object.freeze({
  OK: 'ok',
  LIMITE: 'limite',
  BLOQUEADO: 'bloqueado',
  INDISPONIVEL: 'indisponivel',
  CONFLITO: 'conflito',
})

const MOTIVOS = Object.freeze({
  funcionando: 'O robô está entregando normalmente.',
  limitado: 'O aplicativo pediu para o robô ir mais devagar. As ofertas esperam a vez e continuam saindo.',
  bloqueado: 'O aplicativo recusou o robô inteiro (chave inválida ou robô bloqueado). Ninguém recebe até a troca do robô.',
  indisponivel: 'O aplicativo não está respondendo. As ofertas ficam guardadas e saem quando ele voltar.',
  sem_medicao: 'Ainda não houve envio recente para medir.',
  conflito: 'Outro servidor está lendo o mesmo robô (por exemplo, staging e produção com o mesmo robô). Ninguém consegue ligar grupo novo até isso ser resolvido.',
})

export function computeNetworkHealth(signals = [], { now = Date.now(), windowMs = 10 * 60_000, unavailableStreak = 3 } = {}) {
  const recent = signals
    .filter((s) => s && Number.isFinite(Number(s.at)) && now - Number(s.at) <= windowMs)
    .sort((a, b) => Number(a.at) - Number(b.at))
  if (recent.length === 0) return { estado: NETWORK_HEALTH.SEM_MEDICAO, motivo: MOTIVOS.sem_medicao, desde: null }

  const last = recent[recent.length - 1]
  const sinceOf = (kind) => {
    let since = last.at
    for (let i = recent.length - 1; i >= 0 && recent[i].kind === kind; i--) since = recent[i].at
    return new Date(Number(since))
  }

  // Conflito de leitura (409) é persistente por natureza: vale enquanto
  // aparecer na janela, mesmo com envios dando certo no meio.
  const conflicts = recent.filter((s) => s.kind === HEALTH_SIGNAL.CONFLITO)
  if (conflicts.length >= 2 && now - Number(conflicts[conflicts.length - 1].at) <= 5 * 60_000) {
    return { estado: NETWORK_HEALTH.CONFLITO, motivo: MOTIVOS.conflito, desde: new Date(Number(conflicts[0].at)) }
  }
  if (last.kind === HEALTH_SIGNAL.BLOQUEADO) {
    return { estado: NETWORK_HEALTH.BLOQUEADO, motivo: MOTIVOS.bloqueado, desde: sinceOf(HEALTH_SIGNAL.BLOQUEADO) }
  }
  if (last.kind === HEALTH_SIGNAL.INDISPONIVEL) {
    let streak = 0
    for (let i = recent.length - 1; i >= 0 && recent[i].kind === HEALTH_SIGNAL.INDISPONIVEL; i--) streak++
    if (streak >= unavailableStreak) {
      return { estado: NETWORK_HEALTH.INDISPONIVEL, motivo: MOTIVOS.indisponivel, desde: sinceOf(HEALTH_SIGNAL.INDISPONIVEL) }
    }
  }
  const limitedRecently = recent.some((s) => s.kind === HEALTH_SIGNAL.LIMITE && now - Number(s.at) <= 5 * 60_000)
  if (limitedRecently) {
    const firstLimit = recent.find((s) => s.kind === HEALTH_SIGNAL.LIMITE)
    return { estado: NETWORK_HEALTH.LIMITADO, motivo: MOTIVOS.limitado, desde: new Date(Number(firstLimit.at)) }
  }
  return { estado: NETWORK_HEALTH.FUNCIONANDO, motivo: MOTIVOS.funcionando, desde: null }
}

// Registro em memória das últimas respostas (por aplicativo). Pequeno e
// limitado: guarda no máximo `max` sinais.
export function createHealthRecorder({ max = 200 } = {}) {
  const byNetwork = new Map()
  return {
    record(network, kind, at = Date.now()) {
      if (!byNetwork.has(network)) byNetwork.set(network, [])
      const list = byNetwork.get(network)
      list.push({ kind, at })
      if (list.length > max) list.splice(0, list.length - max)
    },
    signals(network) {
      return [...(byNetwork.get(network) ?? [])]
    },
  }
}

const BAD_STATES = new Set([NETWORK_HEALTH.LIMITADO, NETWORK_HEALTH.BLOQUEADO, NETWORK_HEALTH.INDISPONIVEL, NETWORK_HEALTH.CONFLITO])

// Decide o que avisar numa mudança de estado (T081/T083). Só a TRANSIÇÃO para
// um estado ruim avisa — ficar no mesmo estado não repete o aviso (o cooldown
// do e-mail cobre o resto). Sem medição nunca avisa.
export function decideHealthAlert(previous, next) {
  const prevState = previous?.estado ?? NETWORK_HEALTH.SEM_MEDICAO
  const nextState = next?.estado ?? NETWORK_HEALTH.SEM_MEDICAO
  if (prevState === nextState || !BAD_STATES.has(nextState)) return null
  return {
    sinal: nextState === NETWORK_HEALTH.LIMITADO ? 'delivery_network_throttled' : 'delivery_network_down',
    estado: nextState,
  }
}

export const NETWORK_HEALTH_LABEL = Object.freeze({
  funcionando: 'funcionando',
  limitado: 'limitado no ritmo',
  bloqueado: 'bloqueado',
  indisponivel: 'fora do ar',
  conflito: 'em conflito com outro servidor',
  sem_medicao: 'sem medição',
})
