// Tamanho da MINIATURA EMBUTIDA (`jpegThumbnail`) que vai dentro do proto da
// mensagem — não confundir com a imagem que a pessoa vê depois de baixar.
//
// RCA 2026-09-03 (relato "as imagens só aparecem se clicar",
// samaraoliveiraasam@gmail.com): a `jpegThumbnail` é a ÚNICA coisa que o
// WhatsApp consegue desenhar ANTES de baixar a mídia — é ela que vira a prévia
// borrada atrás do botão de download. Quem está com "Download automático de
// mídia" desligado no aparelho vê só ela; quem está com ligado nunca repara que
// ela existe.
//
// Medido no caminho real (`normalizeImageForWhatsApp`, 500px q80) contra o
// padrão do WhatsApp/Baileys (`extractImageThumb(file, 32)`, 32px q50):
//
//   foto texturizada   500px q80: 57.056 B | 160px q65: 6.853 B | 32px q50: 392 B
//   foto de catálogo   500px q80:  3.239 B | 160px q65:   788 B | 32px q50: 384 B
//
// Na pior foto somos ~145x o padrão. A investigação NÃO provou que o cliente
// recusa a miniatura por tamanho — o que está provado é que as duas contas
// comparadas (a que reclamou e a que não reclamou) enviam pelo MESMO caminho,
// com os MESMOS formatos, e que nos prints da reclamação não há prévia borrada
// nenhuma. Reduzir o tamanho é a única alavanca nossa nesse ponto, e por isso
// entra como interruptor de rollout (default = comportamento histórico), para
// ser validado em staging num celular com download automático DESLIGADO antes
// de virar padrão. Mesmo padrão de COUPON_BRAND_CARD_ENABLED e
// PREVIEW_CARD_HIDE_STORE_TITLE.
//
// Por que não ir direto para 32px como o WhatsApp: a miniatura de 500px foi
// escolhida em 2026 para o card nascer NÍTIDO (o comentário histórico registra
// que 200x200 q60 "estourava" ao ser renderizado em card grande). O card
// continua carregando a versão em alta (`highQualityThumbnail`, upada
// separadamente) — a miniatura embutida é só o primeiro quadro. O custo de
// encolher é um instante de borrão; o ganho é existir prévia para quem hoje vê
// um bloco chapado.
export const INLINE_THUMBNAIL_DEFAULT_PX = 500
export const INLINE_THUMBNAIL_MIN_PX = 32
export const INLINE_THUMBNAIL_CEILING_PX = 500

// Abaixo de 400px a qualidade cai junto: numa miniatura pequena a diferença
// visual entre q80 e q65 não aparece, e é ela que responde pela maior parte dos
// bytes. Em 500px a qualidade fica em 80 para que o default reproduza BYTE A
// BYTE o comportamento histórico.
const HIGH_QUALITY_THRESHOLD_PX = 400
const HIGH_QUALITY = 80
const LOW_QUALITY = 65

/**
 * Tamanho e qualidade da miniatura embutida.
 * Valor ausente, não-numérico, zero ou negativo cai no histórico (500px q80) —
 * `.env` mal preenchido nunca pode deixar a oferta sem miniatura. Valores fora
 * da faixa são grampeados em [32, 500] em vez de rejeitados.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{maxPx: number, quality: number}}
 */
export function resolveInlineThumbnailSpec(env = process.env) {
  const raw = Number.parseInt(String(env?.INLINE_THUMBNAIL_MAX_PX ?? '').trim(), 10)
  const maxPx = Number.isFinite(raw) && raw > 0
    ? Math.min(INLINE_THUMBNAIL_CEILING_PX, Math.max(INLINE_THUMBNAIL_MIN_PX, raw))
    : INLINE_THUMBNAIL_DEFAULT_PX
  return { maxPx, quality: maxPx >= HIGH_QUALITY_THRESHOLD_PX ? HIGH_QUALITY : LOW_QUALITY }
}
