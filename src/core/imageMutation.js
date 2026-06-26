// PR-5.B.2: mutação de imagem fora do bloco protegido.
// Crop 0–2px numa borda determinística por (groupId, date) + qualidade variada.
// Quebra hash MD5 entre canais sem degradar visualmente.
//
// 2026-06 (image-upload-bug-fix): a mutação deixou de ser um SEGUNDO encode
// JPEG aplicado SOBRE a imagem já normalizada (q95) — isso causava dupla
// compressão. A geometria/qualidade do crop virou função PURA
// (computeMutationCrop) e a aplicação real (extract + único encode JPEG)
// passou a viver dentro de normalizeImageForWhatsApp, no MESMO passo sharp.
// mutate() é mantida (utilitário standalone / compat) mas agora delega o
// cálculo para computeMutationCrop.
//
// Regras invioláveis (PR #422 + AGENTS.md):
// - Nunca abaixo de IMAGE_MIN_DIMENSION_PX em ambos os eixos.
// - Mantém mimetype.
// - Em caso de qualquer falha, devolve o buffer original (não bloqueia envio).

import sharp from 'sharp'
import { computeMutationCrop, hashIndex, todayIsoDate, IMAGE_MIN_DIMENSION_PX } from './imageMutationCrop.js'

// Re-export do módulo leaf puro para compatibilidade dos importadores atuais.
export { computeMutationCrop, hashIndex, todayIsoDate, IMAGE_MIN_DIMENSION_PX }

const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/jpg'])

/**
 * Utilitário standalone: aplica a mutação a um JPEG já codificado. Mantido para
 * compat/uso avulso. O caminho de produção (canal) usa computeMutationCrop
 * dentro de normalizeImageForWhatsApp para evitar dupla compressão.
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {{ groupId: string, enabled?: boolean, date?: string, minDimension?: number }} opts
 * @returns {Promise<{ buffer: Buffer, mimetype: string }>}
 */
export async function mutate(buffer, mimetype, opts = {}) {
  if (!opts.enabled) return { buffer, mimetype }
  if (!SUPPORTED_MIMES.has(String(mimetype).toLowerCase())) return { buffer, mimetype }
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) return { buffer, mimetype }

  const date = opts.date ?? todayIsoDate()

  try {
    const meta = await sharp(buffer).metadata()
    const crop = computeMutationCrop(meta, { groupId: opts.groupId, date, minDimension: opts.minDimension })
    if (!crop) return { buffer, mimetype }

    const out = await sharp(buffer)
      .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
      .jpeg({ quality: crop.quality, mozjpeg: false })
      .toBuffer()

    return { buffer: out, mimetype: 'image/jpeg' }
  } catch {
    return { buffer, mimetype }
  }
}
