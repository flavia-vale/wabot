import sharp from 'sharp'
import { resolveInlineThumbnailSpec } from './inlineThumbnailPolicy.js'

// Miniatura embutida (`jpegThumbnail`) a partir de um buffer de imagem.
// Ponto ÚNICO de geração: os três caminhos que alimentam o campo (foto
// normalizada, foto com marca d'água e banner de cupom) passam por aqui, para
// que o tamanho não volte a divergir entre eles.
export async function buildInlineThumbnail(buf) {
  const { maxPx, quality } = resolveInlineThumbnailSpec()
  return sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
}

