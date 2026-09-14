// Como o QR Code chega (ou não) à tela da cliente.
//
// RCA 2026-09-14 (conta taaianeribeiro@hotmail.com): a cliente passou 25
// minutos sem conseguir conectar e o robô dela subiu QUINZE vezes. O robô
// nunca teve defeito: o log de produção mostra `reason:"qr_generated"` menos
// de um segundo depois de CADA start, e o QR só morria ~160s depois com
// "QR refs attempts ended" (ninguém escaneou). O QR existia o tempo todo e
// simplesmente não chegava à tela.
//
// Dois caminhos levavam o QR até a tela, e os dois estavam fechados para ela:
//
//  1. WebSocket (`/api/session/qr`). Em produção o painel fala com a API pela
//     MESMA origem (`NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true`), e nessa origem
//     quem atende `/api/*` é o proxy do Next (`dashboard/app/api/[...path]`),
//     um route handler HTTP que NÃO faz upgrade de WebSocket — ele inclusive
//     descarta o header `upgrade`. Ou seja: o canal de WS não pode funcionar
//     ali por construção. Na telemetria dela isso aparece como zero
//     `qr_received` (via WS) e três `ws_reconnect_attempt` em cinco segundos,
//     quando o limite de tentativas se esgota e a tela desiste para sempre.
//  2. Consulta periódica (o único caminho que de fato entrega em produção —
//     as duas únicas vezes que ela viu um QR foram por
//     `qr_received_polling_fallback`). Só que ela estava atrás de dois
//     portões que a fechavam justamente quando mais precisava.
//
// Por isso a decisão saiu da tela e virou regra pura aqui.
//
// Não regredir:
//
// - **A consulta do QR NÃO pode depender do método escolhido na tela.** Ela
//   dependia de `connectMethod === 'qr'`, e o botão "Reiniciar conexão" /
//   "Resetar instância" (`handleRestart`) nunca liga esse valor. Como a tela
//   nasce em `pairing` — e ela tinha pedido código por número antes —, todo
//   clique em reiniciar caía num estado sem WS e sem consulta: o QR nascia no
//   servidor e não tinha por onde chegar.
// - **A consulta NÃO pode parar quando o primeiro QR aparece.** O WhatsApp
//   rotaciona o QR a cada ~20s; parando na primeira entrega, a tela congela um
//   QR que morre em segundos e depois se declara expirado — com o servidor
//   oferecendo um QR novo e válido o tempo todo. Quem atualiza é esta consulta,
//   não o WS (que em produção não existe).
// - **"Conexão sem progresso" só vale quando não há NADA para escanear.** O
//   aviso oferece "Resetar instância", que para o robô, apaga a credencial e
//   começa de novo. Com um QR válido na tela isso é sabotagem: foi esse botão,
//   oferecido aos 45s, que transformou um defeito de exibição em quinze
//   reinícios — cada clique matava o robô que já tinha o QR pronto.
// - **Fail-safe é MOSTRAR/CONSULTAR.** Sem certeza do estado, consultar de
//   novo custa uma chamada barata; não consultar deixa a cliente olhando uma
//   tela vazia sem saber o que fazer.

/** Intervalo entre consultas ao servidor pelo QR mais recente, em ms. */
export const QR_POLL_INTERVAL_MS = 3000

/** Segundos sem nada na tela antes de oferecer o reset da instância. */
export const INACTIVITY_RESET_SECONDS = 45

/**
 * A tela deve ficar consultando o servidor pelo QR mais recente?
 *
 * Só depende do que o SERVIDOR está fazendo (robô ligado e autenticando), nunca
 * da aba escolhida na tela. O único freio é o pareamento por número: ali a
 * cliente pediu um código, não um QR (e o robô nem emite QR nesse modo).
 */
export function shouldPollQrCode({ running, status, pairingCode } = {}) {
  if (!running) return false
  if (status !== 'connecting') return false
  if (pairingCode) return false
  return true
}

/**
 * O que fazer com o QR que a consulta trouxe.
 *
 * Devolve `changed: true` só quando é um QR DIFERENTE do que está na tela —
 * senão o contador de validade seria reiniciado a cada 3s e o aviso "expira
 * em Xs" nunca andaria.
 */
export function nextQrFromPoll({ current, incoming } = {}) {
  if (!incoming || typeof incoming !== 'string') return { qr: current ?? null, changed: false }
  if (incoming === current) return { qr: current, changed: false }
  return { qr: incoming, changed: true }
}

/**
 * Oferecer "Conexão sem progresso → Resetar instância"?
 *
 * Só quando de fato não há nada para a cliente escanear ou digitar. QR na tela
 * (mesmo vencendo) ou código de pareamento ativo significam que o caminho está
 * aberto — resetar ali destrói uma conexão que ia dar certo.
 */
export function shouldOfferInactivityReset({
  running,
  status,
  connected,
  qr,
  pairingCode,
  elapsedSec,
  thresholdSec = INACTIVITY_RESET_SECONDS,
} = {}) {
  if (!running || connected) return false
  if (status !== 'connecting') return false
  if (qr || pairingCode) return false
  return Number(elapsedSec) >= thresholdSec
}
