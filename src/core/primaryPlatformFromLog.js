// Loja do link principal de uma linha de MessageLog.
//
// `MessageLog.platform` guarda as lojas da mensagem JUNTAS ("shopee+shopee",
// "amazon+shopee") — é rótulo de relatório, não nome de loja. O reenvio depois
// que o robô reinicia (`reprocessRestartFailures` em src/bot-worker.js)
// passava esse rótulo cru para a busca de foto; `fetchProductImage` não
// reconhecia "shopee+shopee", caía na leitura genérica da página e a Shopee
// (link curto, parede anti-robô) não devolvia foto: a oferta saía sem imagem
// (RCA 2026-09-30, docs/rca/imagem-e-preview.md).
//
// Ordem: loja detectada no próprio link principal (é ele que vira o card) →
// primeira loja do rótulo. PURA.
import { detectLinks } from '../detector.js'

export function primaryPlatformFromLog({ platform, originalUrl, convertedUrl } = {}, offerOptions = {}) {
  for (const url of [originalUrl, convertedUrl]) {
    const detected = url ? detectLinks(String(url), offerOptions)[0]?.platform : null
    if (detected) return detected
  }
  const first = String(platform ?? '').split('+').map((part) => part.trim()).find(Boolean)
  return first && first !== 'nolink' ? first : null
}
