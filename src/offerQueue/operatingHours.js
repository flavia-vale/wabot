// Horário de funcionamento POR FILA (OfferQueue). Diferente da janela
// silenciosa global do BotConfig (que é janela de BLOQUEIO), aqui a janela é
// de PERMISSÃO: dentro do intervalo a fila drena, fora dela não.
//
// Suporta cruzamento de meia-noite (ex.: "22:00" -> "06:00"). Timezone fixo
// America/Sao_Paulo, igual ao resto do projeto. Fail-open: configuração
// ausente/inválida => trata como 24h (não bloqueia), para nunca derrubar o
// drain por dado malformado.

const DEFAULT_TZ = 'America/Sao_Paulo'

function tzMinutesOfDay(now, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour').value)
  const minute = Number(parts.find((p) => p.type === 'minute').value)
  return hour * 60 + minute
}

// "HH:mm" -> minutos desde meia-noite, ou null se malformado.
export function parseHHMM(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

// true = AGORA está FORA da janela de funcionamento => fila NÃO deve drenar.
export function isOutsideOperatingHours(now, startHHMM, endHHMM, tz = DEFAULT_TZ) {
  const start = parseHHMM(startHHMM)
  const end = parseHHMM(endHHMM)
  // Fail-open: sem janela válida (ou start == end, intervalo degenerado),
  // funciona 24h.
  if (start == null || end == null || start === end) return false
  const current = tzMinutesOfDay(now, tz)
  const inside = start < end
    ? current >= start && current < end
    : current >= start || current < end
  return !inside
}
