// Política de reconexão do socket WhatsApp (Baileys), extraída como módulo
// PURO (sem I/O, sem timers, sem Baileys) para ser testável de forma
// determinística. O bot-worker.js orquestra os timers/efeitos; aqui mora só
// a matemática de backoff e a decisão sobre o "ping-pong" de socket
// substituído (connectionReplaced / 440).
//
// Contexto: cada vez que o socket faz um `open` novo, o WhatsApp mostra no
// celular a notificação "A sincronização ... foi concluída". Reconexões em
// loop = spam dessa notificação. As duas defesas:
//   1) Backoff exponencial com jitter para closes genéricos.
//   2) Cooldown LONGO + detecção de surto para o caso `connectionReplaced`,
//      onde duas instâncias disputam a MESMA credencial (worker duplicado /
//      double-possession). Sem isso, cada socket reabre a cada poucos segundos
//      e o backoff normal nunca atua (o `open` zera o contador a cada ciclo).

// Delay de backoff exponencial com jitter simétrico (±jitterRatio).
// `attempt` é 0-based: attempt=0 → ~baseMs, attempt=1 → ~2*baseMs, ... cap em maxMs.
export function calcBackoffDelayMs(attempt, { baseMs, maxMs, jitterRatio = 0.2, random = Math.random } = {}) {
  const safeAttempt = Math.max(0, Number(attempt) || 0)
  const base = Math.min(baseMs * Math.pow(2, safeAttempt), maxMs)
  const jitter = base * jitterRatio * (random() * 2 - 1)
  return Math.max(0, Math.round(base + jitter))
}

// Registra um evento `connectionReplaced` na janela deslizante e decide se é
// um surto (ping-pong ativo entre sockets duplicados). NÃO é resetada por um
// `open` curto — é justamente nesse caso que o `open` acontece a cada ciclo;
// só o envelhecimento dos timestamps (windowMs) limpa a janela.
//
// Retorna a nova lista de timestamps (imutável: não muta a entrada), a contagem
// na janela e `escalate` quando atinge o limiar.
export function registerReplacedAndDecide(timestamps, now, { windowMs, giveUpThreshold }) {
  const recent = (timestamps || []).filter(ts => now - ts <= windowMs)
  recent.push(now)
  return {
    timestamps: recent,
    count: recent.length,
    escalate: recent.length >= giveUpThreshold,
  }
}
