// Contador público de uso (B05) — módulo PURO.
//
// Decisão da dona do produto (28/09/2026): o site mostra UM número, o de envios
// de ofertas dos últimos 30 dias, e só com o valor REAL do banco. Os demais
// contadores (afiliadas ativas, lojas, dias de sessão) são pequenos e ficam de
// fora. Número pequeno ou velho engana, então a regra de exibição é dura:
//   - só aparece se o número passar de um piso (`PUBLIC_COUNTER_MIN_SENDS`);
//   - só aparece se o arquivo foi gerado há pouco (`PUBLIC_COUNTER_MAX_AGE_MS`).
// Falhou qualquer uma: some da tela, nunca cai para um valor de reserva.

export const PUBLIC_COUNTER_WINDOW_DAYS = 30
export const PUBLIC_COUNTER_MIN_SENDS = 1000
export const PUBLIC_COUNTER_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

/** Corpo do arquivo gravado pelo script diário. */
export function buildCounterSnapshot({ sends30d, now = new Date() } = {}) {
  const count = Number(sends30d)
  return {
    sends30d: Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0,
    windowDays: PUBLIC_COUNTER_WINDOW_DAYS,
    generatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
  }
}

/**
 * Decide o que a tela mostra.
 * @returns {null | { sends30d: number, label: string }}
 */
export function resolvePublicCounter(snapshot, {
  now = new Date(),
  minSends = PUBLIC_COUNTER_MIN_SENDS,
  maxAgeMs = PUBLIC_COUNTER_MAX_AGE_MS,
} = {}) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const count = Number(snapshot.sends30d)
  if (!Number.isFinite(count) || count < minSends) return null
  if (Number(snapshot.windowDays) !== PUBLIC_COUNTER_WINDOW_DAYS) return null

  const generatedAt = new Date(snapshot.generatedAt)
  if (Number.isNaN(generatedAt.getTime())) return null
  const age = (now instanceof Date ? now : new Date(now)).getTime() - generatedAt.getTime()
  if (age < 0 || age > maxAgeMs) return null

  const rounded = Math.floor(count)
  return {
    sends30d: rounded,
    label: `${rounded.toLocaleString('pt-BR')} envios de ofertas nos últimos 30 dias`,
  }
}
