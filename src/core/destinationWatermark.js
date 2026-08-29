import sharp from 'sharp'

// 'center' é o padrão do produto (2026-08-29): a marca fica no meio da foto,
// com 50% de transparência, para identificar a oferta sem esconder o produto e
// sem poder ser cortada fora como acontece com marca de canto. Os cantos
// continuam suportados pela POC/benchmark, mas a tela da cliente não os oferece.
const POSITIONS = new Set(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'])

// Só duas cores, por decisão de produto: a cliente escolhe conforme as fotos
// dela (marca branca some em foto clara, preta some em foto escura). Qualquer
// outro valor cai no padrão em vez de quebrar o envio.
export const WATERMARK_COLORS = Object.freeze({ white: '#ffffff', black: '#000000' })

// 25 caracteres: a marca é centralizada e grande o bastante para ser lida na
// miniatura do WhatsApp; texto mais longo teria de encolher tanto que deixaria
// de cumprir a função.
export const WATERMARK_MAX_CHARS = 25

const DEFAULTS = Object.freeze({
  position: 'center',
  color: 'white',
  opacity: 0.5,
  maxWidthPercent: 70,
})
const MIN_WATERMARK_DIMENSION = 160

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function normalizeWatermarkConfig(raw = {}) {
  const text = String(raw.text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('Marca d\'agua sem texto')
  if ([...text].length > WATERMARK_MAX_CHARS) {
    throw new Error(`Marca d'agua deve ter no maximo ${WATERMARK_MAX_CHARS} caracteres`)
  }

  const position = raw.position ?? DEFAULTS.position
  if (!POSITIONS.has(position)) throw new Error(`Posicao de marca d'agua invalida: ${position}`)

  // Cor desconhecida NAO derruba o envio: cai no padrao. A marca e enfeite;
  // perder a oferta inteira por causa de um valor legado no banco seria pior.
  const color = Object.hasOwn(WATERMARK_COLORS, raw.color) ? raw.color : DEFAULTS.color

  const opacity = Number(raw.opacity ?? DEFAULTS.opacity)
  if (!Number.isFinite(opacity) || opacity < 0.25 || opacity > 0.9) {
    throw new Error('Opacidade deve estar entre 0.25 e 0.9')
  }

  const maxWidthPercent = Number(raw.maxWidthPercent ?? DEFAULTS.maxWidthPercent)
  if (!Number.isFinite(maxWidthPercent) || maxWidthPercent < 20 || maxWidthPercent > 70) {
    throw new Error('Largura maxima deve estar entre 20 e 70 por cento')
  }

  return { text, position, color, opacity, maxWidthPercent }
}

export async function createSampleInput() {
  const card = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">' +
    '<rect width="1200" height="800" fill="#eef2ff"/>' +
    '<rect x="90" y="90" width="1020" height="620" rx="42" fill="#ffffff"/>' +
    '<circle cx="390" cy="400" r="210" fill="#fbbf24"/>' +
    '<text x="690" y="310" text-anchor="middle" font-family="DejaVu Sans,Arial" font-size="38" font-weight="700" fill="#111827">OFERTA DE TESTE</text>' +
    '<text x="690" y="405" text-anchor="middle" font-family="DejaVu Sans,Arial" font-size="72" font-weight="700" fill="#dc2626">R$ 99,90</text>' +
    '<text x="690" y="480" text-anchor="middle" font-family="DejaVu Sans,Arial" font-size="28" fill="#475569">Imagem gerada pela POC</text>' +
    '</svg>',
  )
  return sharp(card).jpeg({ quality: 95 }).toBuffer()
}

function wrapText(text, maxCharacters) {
  const words = text.split(' ').flatMap(word => {
    const characters = [...word]
    if (characters.length <= maxCharacters) return word
    const chunks = []
    for (let index = 0; index < characters.length; index += maxCharacters) {
      chunks.push(characters.slice(index, index + maxCharacters).join(''))
    }
    return chunks
  })
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if ([...candidate].length <= maxCharacters || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  if (lines.length <= 2) return lines
  return [lines[0], `${lines.slice(1).join(' ').slice(0, Math.max(1, maxCharacters - 1))}…`]
}

// Marca CENTRALIZADA (o formato do produto). Sem caixa atrás do texto: a caixa
// existe no estilo de canto para garantir contraste, mas no meio da foto ela
// taparia justamente o produto. Aqui o que dá o efeito de marca d'água é o
// próprio texto a 50% — por isso a cliente escolhe entre branco e preto
// conforme as fotos dela.
//
// O SVG tem o tamanho da imagem inteira e é composto em (0,0): deixar o
// alinhamento para o `text-anchor` do SVG evita a conta de centralização
// manual, que erraria em toda imagem não-quadrada.
function buildCenteredOverlay({ imageWidth, imageHeight, config }) {
  const shortSide = Math.min(imageWidth, imageHeight)
  // Com o teto de 25 caracteres, quebrar em ~14 dá no máximo duas linhas.
  const lines = wrapText(config.text, 14)
  const longest = Math.max(...lines.map(line => [...line].length))
  const maxTextWidth = imageWidth * config.maxWidthPercent / 100
  const AVERAGE_GLYPH_RATIO = 0.62
  const fitFontSize = Math.floor(maxTextWidth / Math.max(1, longest * AVERAGE_GLYPH_RATIO))
  // Dois tetos: a largura pedida e uma fração do lado menor — sem o segundo,
  // marca de 3 letras viraria um letreiro cobrindo a foto inteira.
  const fontSize = Math.max(14, Math.min(fitFontSize, Math.round(shortSide * 0.2)))
  const lineHeight = Math.round(fontSize * 1.15)
  const blockHeight = lineHeight * lines.length
  const firstBaseline = Math.round(imageHeight / 2 - blockHeight / 2 + fontSize * 0.82)
  const fill = WATERMARK_COLORS[config.color]
  const textNodes = lines.map((line, index) => (
    `<text x="${Math.round(imageWidth / 2)}" y="${firstBaseline + index * lineHeight}" ` +
    'text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" ' +
    `font-size="${fontSize}" font-weight="700" fill="${fill}" fill-opacity="${config.opacity}">` +
    `${escapeXml(line)}</text>`
  )).join('')

  return {
    width: imageWidth,
    height: imageHeight,
    buffer: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">${textNodes}</svg>`,
    ),
  }
}

// Estilo de CANTO (legado): caixa escura com texto branco. Continua alcançável
// pela POC/benchmark; a tela da cliente não oferece essas posições.
function buildOverlay({ imageWidth, imageHeight, config }) {
  const shortSide = Math.min(imageWidth, imageHeight)
  const fontSize = Math.max(14, Math.min(54, Math.round(shortSide * 0.045)))
  const paddingX = Math.max(10, Math.round(fontSize * 0.65))
  const paddingY = Math.max(7, Math.round(fontSize * 0.42))
  const maxOverlayWidth = Math.round(imageWidth * config.maxWidthPercent / 100)
  const averageGlyphWidth = fontSize * 0.72
  const maxCharacters = Math.max(10, Math.floor((maxOverlayWidth - paddingX * 2) / averageGlyphWidth))
  const lines = wrapText(config.text, maxCharacters)
  const longest = Math.max(...lines.map(line => [...line].length))
  const width = Math.min(maxOverlayWidth, Math.max(80, Math.ceil(longest * averageGlyphWidth + paddingX * 2)))
  const lineHeight = Math.round(fontSize * 1.18)
  const height = paddingY * 2 + lineHeight * lines.length
  const textNodes = lines.map((line, index) => (
    `<text x="${paddingX}" y="${paddingY + fontSize + index * lineHeight}" ` +
    `font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${escapeXml(line)}</text>`
  )).join('')

  return {
    width,
    height,
    buffer: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" rx="${Math.round(fontSize * 0.3)}" fill="#111827" fill-opacity="${config.opacity}"/>` +
      `${textNodes}</svg>`,
    ),
  }
}

export async function renderDestinationWatermark(input, rawConfig, options = {}) {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new Error('Imagem de entrada invalida')
  const config = normalizeWatermarkConfig(rawConfig)
  const startedAt = process.hrtime.bigint()

  // RAW intermediario: resize/rotate e composite terminam em um unico encode JPEG
  // da imagem principal, evitando a dupla compressao que a POC precisa medir.
  const { data, info } = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: options.maxDimension ?? 1600, height: options.maxDimension ?? 1600, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let watermarkApplied = false
  let skipReason = null
  let mainResult
  if (Math.min(info.width, info.height) < MIN_WATERMARK_DIMENSION) {
    skipReason = 'image_too_small'
    mainResult = await sharp(data, { raw: info })
      .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true })
  } else {
    let overlay
    let top
    let left
    if (config.position === 'center') {
      overlay = buildCenteredOverlay({ imageWidth: info.width, imageHeight: info.height, config })
      top = 0
      left = 0
    } else {
      const margin = Math.max(8, Math.round(Math.min(info.width, info.height) * 0.025))
      overlay = buildOverlay({ imageWidth: info.width - margin * 2, imageHeight: info.height - margin * 2, config })
      top = config.position.startsWith('top') ? margin : info.height - overlay.height - margin
      left = config.position.endsWith('left') ? margin : info.width - overlay.width - margin
    }
    mainResult = await sharp(data, { raw: info })
      .composite([{ input: overlay.buffer, top, left, blend: 'over' }])
      .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true })
    watermarkApplied = true
  }
  const { data: main, info: mainInfo } = mainResult

  // A miniatura nasce da imagem principal ja marcada para nunca divergir no WhatsApp.
  const thumbnail = await sharp(main)
    .resize({ width: 500, height: 500, fit: 'inside', withoutEnlargement: true })
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()

  return {
    main,
    thumbnail,
    width: mainInfo.width,
    height: mainInfo.height,
    durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
    config,
    watermarkApplied,
    skipReason,
  }
}
