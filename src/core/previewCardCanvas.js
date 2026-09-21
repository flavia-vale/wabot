import sharp from 'sharp'
import { resolvePreviewCardCanvas } from './previewCardCanvasPolicy.js'
import { buildInlineThumbnail } from './inlineThumbnail.js'
import { upscaleCardPhotoIfTiny } from './cardPhoto.js'

// Compõe a foto do card na TELA FIXA (ver o RCA em previewCardCanvasPolicy.js).
// Ponto ÚNICO: os dois montadores de card (buildManualLinkPreview, do
// espelhamento, e buildBroadcastLinkPreview, da fila/automáticas) passam por
// aqui, para o tamanho não voltar a divergir entre eles.
//
// A foto entra INTEIRA (`fit: inside`) e nunca é cortada. Antes de montar a
// tela, miniaturas são ampliadas pelo ponto único de política de card. Essa
// ordem é essencial: ampliar DEPOIS da composição só enxerga o canvas 1080px e
// deixa a foto original pequena como um selo no centro.

// Fundo desfocado a partir de uma redução agressiva: desfocar 1080px custa caro
// e o resultado visual é o mesmo de ampliar uma versão minúscula.
const BACKDROP_SRC_PX = 32
const BACKDROP_BLUR_SIGMA = 12

/**
 * @param {Buffer} input foto já resolvida (loja, origem ou banner)
 * @param {{env?: NodeJS.ProcessEnv, upscale?: boolean}} [opts]
 * @returns {Promise<{main: Buffer, thumbnail: Buffer, width: number, height: number, upscaled: null|{from:number,to:number}}|null>}
 *   `null` quando a tela fixa está desligada ou a composição falha — quem chama
 *   segue com a foto como ela veio (nunca perde a oferta por causa disto).
 */
export async function composePreviewCardImage(input, opts = {}) {
  const { enabled, size } = resolvePreviewCardCanvas(opts.env)
  if (!enabled) return null
  if (!Buffer.isBuffer(input) || input.length === 0) return null

  try {
    // Banner de cupom pode optar por não ampliar: ele já nasce no tamanho
    // deliberado pelo design. Fotos de produto usam o default seguro.
    const preparada = opts.upscale === false
      ? { buffer: input, upscaled: null }
      : await upscaleCardPhotoIfTiny(input)
    const source = preparada.buffer

    const { data: foto, info: fotoInfo } = await sharp(source, { failOn: 'none' })
      .rotate()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .sharpen({ sigma: 0.5 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Já cobre a tela inteira? Não há moldura para desenhar — evita o custo do
    // fundo desfocado no caso mais comum (foto de catálogo quadrada e grande).
    const precisaMoldura = fotoInfo.width < size || fotoInfo.height < size

    let pipeline
    if (precisaMoldura) {
      const miniatura = await sharp(source, { failOn: 'none' })
        .rotate()
        .resize({ width: BACKDROP_SRC_PX, height: BACKDROP_SRC_PX, fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()
      const { data: fundo, info: fundoInfo } = await sharp(miniatura)
        .resize({ width: size, height: size, fit: 'fill' })
        .blur(BACKDROP_BLUR_SIGMA)
        .flatten({ background: '#ffffff' })
        .raw()
        .toBuffer({ resolveWithObject: true })
      pipeline = sharp(fundo, { raw: fundoInfo }).composite([{
        input: foto,
        raw: { width: fotoInfo.width, height: fotoInfo.height, channels: fotoInfo.channels },
        top: Math.round((size - fotoInfo.height) / 2),
        left: Math.round((size - fotoInfo.width) / 2),
      }])
    } else {
      pipeline = sharp(foto, { raw: { width: fotoInfo.width, height: fotoInfo.height, channels: fotoInfo.channels } })
        .flatten({ background: '#ffffff' })
    }

    const { data: main, info } = await pipeline
      .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true })

    // A miniatura embutida nasce da MESMA imagem composta: é ela que o WhatsApp
    // desenha antes de baixar, e divergir aqui traria de volta o "muda de
    // tamanho ao carregar".
    const thumbnail = await buildInlineThumbnail(main)
    return { main, thumbnail, width: info.width, height: info.height, upscaled: preparada.upscaled }
  } catch {
    return null
  }
}
