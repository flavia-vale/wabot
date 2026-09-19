// Validação da marca d'água no lado da API — SEM `sharp`.
//
// O renderizador (core/destinationWatermark.js) é a fonte da verdade do
// formato, mas a API não pode importá-lo: ele carrega `sharp` (binário nativo)
// e o processo da API o mantém de fora de propósito (política de memória do
// AGENTS.md, mesmo motivo do lazy load em routes/linkConversion.js).
//
// Este módulo é o lugar ÚNICO onde a API repete o limite e as cores, para que
// as três telas que hoje oferecem marca d'água (destino de espelhamento, fila
// de ofertas e ofertas automáticas) validem exatamente igual. Antes de existir,
// cada rota copiava o número por conta própria. Guarda contra divergência em
// test/watermark-limite-caracteres.test.js.

// Espelha WATERMARK_MAX_CHARS de core/destinationWatermark.js.
export const WATERMARK_INPUT_MAX_CHARS = 25

// Espelha as chaves de WATERMARK_COLORS de core/destinationWatermark.js.
export const WATERMARK_INPUT_COLORS = Object.freeze(['white', 'black'])

// Espelha WATERMARK_SIZES de core/destinationWatermark.js.
export const WATERMARK_INPUT_SIZES = Object.freeze(['small', 'medium', 'large'])

// Espelha as posições aceitas por core/destinationWatermark.js (a validação
// de posição sempre existiu lá; a API nunca repetiu essa lista antes de a
// tela passar a oferecer os cantos).
export const WATERMARK_INPUT_POSITIONS = Object.freeze([
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
])

/**
 * Normaliza o texto como o renderizador normaliza (espaços colapsados, aparado).
 * Devolve `undefined` quando o campo nem veio no corpo — a diferença entre
 * "não mexeu" e "apagou" precisa sobreviver até o update parcial.
 */
export function normalizeWatermarkInputText(value) {
  if (value === undefined) return undefined
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Unicode-aware: `[...string].length` conta codepoints, não unidades UTF-16 —
 * mesmo critério do renderizador e do contador da tela, para os três nunca
 * divergirem num emoji.
 */
export function isWatermarkTextTooLong(text) {
  return [...String(text ?? '')].length > WATERMARK_INPUT_MAX_CHARS
}

export function isValidWatermarkColor(value) {
  return WATERMARK_INPUT_COLORS.includes(value)
}

export function isValidWatermarkSize(value) {
  return WATERMARK_INPUT_SIZES.includes(value)
}

export function isValidWatermarkPosition(value) {
  return WATERMARK_INPUT_POSITIONS.includes(value)
}
