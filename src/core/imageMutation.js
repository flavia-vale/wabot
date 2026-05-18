// PR-5.B.2: mutação de imagem fora do bloco protegido.
// Aplicada APÓS o scraper (src/converters/imageScrapers.js) — recompress
// + crop 0–2px numa borda determinística por (groupId, date). Quebra hash
// MD5 entre canais sem degradar visualmente.
//
// Regras invioláveis (PR #422 + AGENTS.md):
// - Nunca abaixo de IMAGE_MIN_DIMENSION_PX em ambos os eixos.
// - Mantém mimetype.
// - Em caso de qualquer falha, devolve o buffer original (não bloqueia envio).

import sharp from 'sharp'

export const IMAGE_MIN_DIMENSION_PX = 800
const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/jpg'])

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

/**
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {{ groupId: string, enabled?: boolean, date?: string, minDimension?: number }} opts
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
export async function mutate(buffer, mimetype, opts = {}) {
  if (!opts.enabled) return { buffer, mimetype }
  if (!SUPPORTED_MIMES.has(String(mimetype).toLowerCase())) return { buffer, mimetype }
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) return { buffer, mimetype }

  const groupId = opts.groupId ?? 'unknown'
  const date = opts.date ?? new Date().toISOString().slice(0, 10)
  const minDim = opts.minDimension ?? IMAGE_MIN_DIMENSION_PX

  try {
    const meta = await sharp(buffer).metadata()
    if (!meta?.width || !meta?.height) return { buffer, mimetype }

    // Crop 1–2px numa borda determinística. Borda 0..3 (top/right/bottom/left)
    // e px 1..2. Total crop por eixo no pior caso: 2px.
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

    if (width < minDim || height < minDim) return { buffer, mimetype }

    const out = await sharp(buffer)
      .extract({ left, top, width, height })
      .jpeg({ quality, mozjpeg: false })
      .toBuffer()

    return { buffer: out, mimetype: 'image/jpeg' }
  } catch {
    return { buffer, mimetype }
  }
}
