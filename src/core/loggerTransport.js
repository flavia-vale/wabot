// Como o logger escreve: com ou sem worker thread. (2026-09-18)
//
// MEDIDO: uma worker thread VAZIA do Node custa 11,7 MiB de PSS (reproduzido
// 2x). E `pino({ transport: ... })` não é um destino — desde o pino 7 ele sobe
// um `thread-stream`, ou seja, **uma worker thread**, que no Node é uma isolate
// INTEIRA do V8, com heap, pilha e arenas próprios. Ela não aparece em
// `heapUsed`/`heapTotal` (que são da isolate principal) e aparece inteira no
// RSS — é exatamente o formato do achado "94% da memória é invisível"
// (docs/analise-ram-memoria-nativa-2026-09-16.md).
//
// Como `src/logger.js` é importado por 17 módulos, a thread existe em TODO
// processo do produto: api, dashboard, bot-supervisor, os ~46 bot-workers e os
// três de staging. Os 11,7 MiB são o PISO — a thread real carrega o
// `pino-pretty` dentro dela e colore cada linha.
//
// ⚠️ A correção NÃO é "tirar o pino-pretty". Enquanto sobrar um alvo em
// `transport`, a thread continua existindo. O que a remove é trocar o
// MECANISMO: `pino.multistream`, que roda no próprio processo.
//
// O que se perde no modo `inline`: a saída do PM2 (`~/.pm2/logs/*-out.log`)
// deixa de ser colorida e passa a ser JSON — o MESMO formato do `bot.log`, que
// é o arquivo que todos os RCAs deste produto leem. Continua greppável, e fica
// consistente entre os dois. **Nenhuma linha de log deixa de ser escrita.**
//
// Nasce DESLIGADO: sem env, `worker` — byte a byte o comportamento histórico.

export const LOG_TRANSPORT_MODES = Object.freeze({
  WORKER: 'worker',
  INLINE: 'inline',
})

/**
 * Decide o mecanismo de escrita do logger. PURA: não importa pino, não toca
 * disco. Valor desconhecido cai no histórico — `.env` mal preenchido nunca pode
 * mudar o jeito de logar em silêncio.
 */
export function resolveLogTransportMode(env = process.env) {
  const raw = String(env.LOG_TRANSPORT_MODE ?? '').trim().toLowerCase()
  return raw === LOG_TRANSPORT_MODES.INLINE ? LOG_TRANSPORT_MODES.INLINE : LOG_TRANSPORT_MODES.WORKER
}
