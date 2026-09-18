// Foto do card de preview saindo como SELO pequeno no meio de um fundo borrado.
//
// RCA 2026-09-18 — print da cliente: o card do tênis (Magalu, link
// `magazinevoce.com.br`) chegou com a foto ocupando um quadradinho no centro,
// cercada por uma versão ampliada e borrada dela mesma.
//
// CAUSA: `prepareWAMessageMedia` lê as dimensões REAIS do buffer que sobe e
// grava `thumbnailWidth`/`thumbnailHeight` no proto (Utils/messages.js). O
// WhatsApp desenha o card no tamanho declarado e preenche o resto com borrão.
// Quando a foto do card é a da mensagem de origem (plano B de
// `previewImageFallbackPolicy.js`), ela costuma ser a miniatura embutida do
// card da origem — medido na conta da cliente: **5.539 bytes**, umas poucas
// centenas de pixels. `normalizeImageForWhatsApp` redimensiona com
// `withoutEnlargement: true`, de propósito, então essa foto chega pequena ao
// upload e o card nasce do tamanho dela.
//
// Isso NÃO é problema de Magalu: o mesmo `bot.log` mostra o plano B agindo em
// Mercado Livre e Shopee. Toda oferta que cai no plano B sai assim.
//
// POR QUE AMPLIAR É O CERTO AQUI (e não no envio de foto normal): em 2026-08-26
// ficou decidido NÃO publicar miniatura minúscula como imagem de corpo inteiro
// — ampliada daquele jeito ela vira um borrão ilegível em tela cheia. Mas o
// mesmo RCA registra que **"miniatura pequena DENTRO de um card é legível"**. É
// exatamente este caso: a alternativa não é uma foto melhor, é o selo com fundo
// borrado que a cliente mandou no print. Ampliar não inventa detalhe, mas faz o
// card ocupar a largura toda — e o card é pequeno por natureza, então a perda
// de nitidez ali é muito menor do que em tela cheia.
//
// O piso reaproveita `IMAGE_HIRES_MIN_DIMENSION_PX` (800), que já é a definição
// da casa de "resolução suficiente para o card grande do WhatsApp"
// (`imageScrapers.js`) — não é número tirado por analogia.

const DEFAULT_CARD_MIN_PX = 800

// Teto de segurança: ampliar além disso só gasta CPU e banda sem o card ficar
// maior (o próprio `normalizeImageForWhatsApp` para em 1600).
const MAX_CARD_MIN_PX = 1600
// Piso de segurança: abaixo disso não vale ampliar — não resolve o selo.
const MIN_CARD_MIN_PX = 200

/**
 * A partir de qual dimensão o card já nasce grande o bastante?
 *
 * `PREVIEW_CARD_MIN_PX=0` desliga a ampliação (volta ao comportamento
 * histórico, o do print). Valor inválido cai no padrão — `.env` mal preenchido
 * nunca pode mudar o formato da oferta em silêncio.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number} 0 quando desligado
 */
export function resolveCardPhotoMinPx(env = process.env) {
  const raw = String(env?.PREVIEW_CARD_MIN_PX ?? '').trim()
  if (raw === '') return DEFAULT_CARD_MIN_PX
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_CARD_MIN_PX
  if (parsed <= 0) return 0
  if (parsed < MIN_CARD_MIN_PX) return MIN_CARD_MIN_PX
  if (parsed > MAX_CARD_MIN_PX) return MAX_CARD_MIN_PX
  return Math.round(parsed)
}

/**
 * Esta foto precisa ser ampliada para o card não sair como selo?
 *
 * Fail-safe é NÃO ampliar: sem dimensão confiável, a foto sobe como está — é o
 * comportamento de hoje, e o card com selo é melhor que oferta sem foto.
 *
 * @param {{width?:number|null, height?:number|null, minPx?:number}} params
 * @returns {number|null} dimensão alvo, ou null quando não há o que fazer
 */
export function resolveCardPhotoUpscaleTarget({ width, height, minPx = resolveCardPhotoMinPx() } = {}) {
  if (!Number.isFinite(minPx) || minPx <= 0) return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  if (Math.max(width, height) >= minPx) return null
  return minPx
}
