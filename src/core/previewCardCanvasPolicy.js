// TELA FIXA DO CARD DE PREVIEW (decisão pura — sem sharp, sem I/O).
//
// RCA 2026-09-16 (relatos "imagens quebradas", "preview com imagem pequena",
// "cada oferta vem com a imagem de um tamanho"):
//
// O card de preview não tem tamanho próprio — quem decide como o WhatsApp
// desenha o card é a MINIATURA que sobe em `highQualityThumbnail`
// (`prepareWAMessageMedia` lê width/height do buffer e grava em
// thumbnailWidth/thumbnailHeight do proto). Até aqui esse buffer era a foto da
// loja COMO ELA VEIO: Mercado Livre manda 1080x1080, Amazon 1500x1500, Shopee
// varia, a foto da mensagem de origem (plano B) às vezes tem 300px e o banner
// de cupom nasce 720x720. Como `normalizeImageForWhatsApp` usa
// `withoutEnlargement: true`, foto pequena continua pequena.
//
// Daí os três sintomas, que são o MESMO defeito visto de ângulos diferentes:
//   - "cada oferta de um tamanho": cada loja tem a sua proporção e a sua
//     resolução, e o card acompanha;
//   - "imagem pequena": foto de origem/miniatura pequena vira card compacto
//     (o Desktop/Web respeita as dimensões gravadas);
//   - "imagem quebrada": foto muito alta ou muito larga é cortada no centro
//     pelo cliente para caber no card, e o produto sai fatiado.
//
// Grupo profissional não tem isso porque publica sempre na MESMA tela: a foto
// entra inteira numa moldura de tamanho fixo. É o que esta política faz — a
// foto nunca é cortada (entra por inteiro, `fit: inside`) e o que sobra é
// preenchido por um fundo desfocado da própria foto, então o card tem SEMPRE
// as mesmas dimensões, venha a foto de onde vier.
//
// Interruptor de rollout no mesmo padrão das outras envs de aparência
// (COUPON_BRAND_CARD_ENABLED, PREVIEW_CARD_ORIGIN_FALLBACK,
// INLINE_THUMBNAIL_MAX_PX): `PREVIEW_CARD_CANVAS=off` volta ao comportamento
// histórico sem redeploy (pegadinha #1: aplicar exige pm2 delete + start).
//
// Quadrado por decisão de produto: é a proporção nativa da foto de catálogo de
// Amazon/Mercado Livre/Shopee, então na maioria das ofertas não sobra moldura
// nenhuma — a tela fixa só aparece quando a foto FUGIRIA do padrão, que é
// exatamente o caso que a cliente reclamou.
export const PREVIEW_CARD_CANVAS_DEFAULT_PX = 1080
export const PREVIEW_CARD_CANVAS_MIN_PX = 480
export const PREVIEW_CARD_CANVAS_MAX_PX = 1600

/**
 * Tela fixa do card.
 * Valor ausente/ilegível cai no padrão — `.env` mal preenchido nunca pode
 * deixar a oferta sem card. Fora da faixa é grampeado, não rejeitado.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{enabled: boolean, size: number}}
 */
export function resolvePreviewCardCanvas(env = process.env) {
  const flag = String(env?.PREVIEW_CARD_CANVAS ?? '').trim().toLowerCase()
  const enabled = !(flag === 'off' || flag === 'false' || flag === '0')
  const raw = Number.parseInt(String(env?.PREVIEW_CARD_CANVAS_PX ?? '').trim(), 10)
  const size = Number.isFinite(raw) && raw > 0
    ? Math.min(PREVIEW_CARD_CANVAS_MAX_PX, Math.max(PREVIEW_CARD_CANVAS_MIN_PX, raw))
    : PREVIEW_CARD_CANVAS_DEFAULT_PX
  return { enabled, size }
}
