// Módulo puro (sem io/db): decide se um envio que está esperando na fila há
// tempo demais deve ser DESCARTADO em vez de sair.
//
// RCA 2026-07 (fila de 489 itens em produção, mensagem da meia-noite saindo às
// 14h): quando a entrada de ofertas é maior que a cadência que o destino
// aceita, a fila cresce e nunca volta. Duas consequências, ambas ruins:
//   1. a cliente recebe oferta velha (preço/estoque já mudaram);
//   2. a fila grande liga o freio progressivo anti-ban, que derruba a vazão de
//      TODOS os destinos (ver buildQueuePressureDelayMs no bot-worker).
//
// Em vez de acumular para sempre, cada destino ganha um teto de espera na
// Preservação (`queueMaxAgeMin`, default 300 = 5h). Passou disso, a oferta é
// descartada com motivo próprio no painel — não é erro de envio, é decisão.
//
// `0` (ou negativo/ausente) desliga o descarte: a fila volta a crescer sem
// limite, comportamento histórico. Escape hatch consciente.

export const DEFAULT_QUEUE_MAX_AGE_MIN = 300

/**
 * @param {object} params
 * @param {number|null} params.enqueuedAt   epoch ms de quando o job entrou na fila
 * @param {number|null} params.queueMaxAgeMin teto de espera em minutos (0/null = desligado)
 * @param {number} [params.now]
 * @returns {{ drop: boolean, ageMs: number|null, maxAgeMs: number }}
 */
export function shouldDropExpiredQueueJob({ enqueuedAt, queueMaxAgeMin, now = Date.now() } = {}) {
  const maxMin = Number(queueMaxAgeMin)
  const maxAgeMs = Number.isFinite(maxMin) && maxMin > 0 ? maxMin * 60_000 : 0
  if (maxAgeMs === 0) return { drop: false, ageMs: null, maxAgeMs: 0 }

  const enqueued = Number(enqueuedAt)
  // Sem carimbo de entrada não dá para medir idade: NÃO descarta (fail-safe —
  // descartar por dúvida perderia oferta legítima).
  if (!Number.isFinite(enqueued) || enqueued <= 0) return { drop: false, ageMs: null, maxAgeMs }

  const ageMs = now - enqueued
  return { drop: ageMs > maxAgeMs, ageMs, maxAgeMs }
}

/** Texto curto de motivo para o MessageLog (prefixo canônico da taxonomia). */
export function buildQueueExpiredReason({ ageMs, maxAgeMs }) {
  const min = (ms) => Math.round(Number(ms || 0) / 60_000)
  return `skip:queue_expired:age=${min(ageMs)}min:max=${min(maxAgeMs)}min`
}
