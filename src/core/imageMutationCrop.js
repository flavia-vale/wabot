// Módulo LEAF puro (sem sharp) — geometria/qualidade do crop anti-fingerprint.
// Separado de imageMutation.js (que importa sharp) para ser testável em
// qualquer ambiente e consumível por normalizeImageForWhatsApp sem arrastar o
// binário nativo na cadeia de import. Mesmo padrão de workerSpawnOptions.js.
//
// Regras invioláveis (PR #422 + AGENTS.md):
// - Nunca abaixo de IMAGE_MIN_DIMENSION_PX em ambos os eixos (retorna null).
// - Crop de no máximo 2px por eixo, numa borda determinística por (groupId, date).

export const IMAGE_MIN_DIMENSION_PX = 800

export function hashIndex(...args) {
  const mod = args[args.length - 1]
  const parts = args.slice(0, -1).join('|')
  let h = 2166136261 >>> 0
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h % mod
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Calcula geometria do crop anti-fingerprint e a qualidade JPEG variada.
 * Retorna null quando o crop deixaria algum eixo abaixo de minDimension
 * (não mutar é melhor que degradar).
 *
 * @param {{ width?: number, height?: number }} meta dimensões da imagem JÁ
 *        normalizada (pós-resize) onde o crop será aplicado.
 * @param {{ groupId?: string, date?: string, minDimension?: number }} opts
 * @returns {{ left: number, top: number, width: number, height: number, quality: number } | null}
 */
export function computeMutationCrop(meta, opts = {}) {
  if (!meta?.width || !meta?.height) return null
  const groupId = opts.groupId ?? 'unknown'
  const date = opts.date ?? todayIsoDate()
  const minDim = opts.minDimension ?? IMAGE_MIN_DIMENSION_PX

  // Borda 0..3 (top/right/bottom/left) e px 1..2. Pior caso: 2px por eixo.
  const edge = hashIndex(groupId, date, 4)
  const cropPx = 1 + hashIndex(groupId, date + 'p', 2) // 1 ou 2
  const quality = 85 + hashIndex(groupId, date + 'q', 8) // 85..92

  let left = 0, top = 0
  let width = meta.width
  let height = meta.height
  if (edge === 0) { top = cropPx; height -= cropPx }
  else if (edge === 1) { width -= cropPx }
  else if (edge === 2) { height -= cropPx }
  else { left = cropPx; width -= cropPx }

  if (width < minDim || height < minDim) return null
  return { left, top, width, height, quality }
}
