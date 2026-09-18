import sharp from 'sharp'
import { resolveCardPhotoUpscaleTarget } from './cardPhotoUpscalePolicy.js'

// Ponto ÚNICO de ampliação da foto do card de preview. Mesmo padrão de
// `inlineThumbnail.js`: a decisão (quando ampliar) mora no módulo puro
// `cardPhotoUpscalePolicy.js`; aqui fica só o trabalho de imagem.
//
// Ver o RCA no topo daquele módulo para o porquê: `prepareWAMessageMedia` grava
// no proto as dimensões reais do buffer que sobe, e o WhatsApp desenha o card
// nesse tamanho — foto pequena vira selo com fundo borrado.

/**
 * Amplia a foto do card quando ela é pequena demais para preencher o card.
 *
 * Best-effort de propósito: qualquer falha devolve o buffer ORIGINAL. Card com
 * selo é ruim; card sem foto (ou oferta em texto puro) é pior — a mesma regra
 * que vale para a marca d'água e para o plano B da foto de origem.
 *
 * @param {Buffer} buf
 * @returns {Promise<{buffer: Buffer, upscaled: null|{from: number, to: number}}>}
 */
export async function upscaleCardPhotoIfTiny(buf) {
  const inalterado = { buffer: buf, upscaled: null }
  if (!buf?.length) return inalterado

  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata()
    const target = resolveCardPhotoUpscaleTarget({ width: meta?.width, height: meta?.height })
    if (!target) return inalterado

    const ampliada = await sharp(buf, { failOn: 'none' })
      .rotate()
      // `fit: 'inside'` preserva a proporção (nada de esticar a foto) e, sem
      // `withoutEnlargement`, é justamente a ampliação que queremos aqui — ao
      // contrário de `normalizeImageForWhatsApp`, que a barra de propósito
      // para não publicar borrão em tela cheia.
      .resize({ width: target, height: target, fit: 'inside' })
      // `sharpen` leve recupera parte da definição perdida na ampliação. Vem
      // ANTES do encode para não somar um segundo encode JPEG.
      .sharpen({ sigma: 0.7 })
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer()

    return { buffer: ampliada, upscaled: { from: Math.max(meta.width, meta.height), to: target } }
  } catch {
    return inalterado
  }
}
