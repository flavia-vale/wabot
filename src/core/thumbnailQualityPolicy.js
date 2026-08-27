// "A foto chegou toda borrada": piso mínimo de qualidade para a imagem que
// publicamos — módulo puro.
//
// RCA 2026-08-26 (cliente julianepumuceno16@gmail.com): a oferta do Cooktop saiu
// com uma imagem irreconhecível. O log mostra o caminho inteiro:
//
//   "Usando thumbnail do link preview" { source: 'jpegThumbnail', size: 457 }
//   "resolveMonitoredImage: fetchProductImage" { platform: 'shopee' }
//   (nenhum "imagem alta-res obtida via marketplace")
//
// Ou seja: a mensagem de origem não trazia imagem de verdade, só a miniatura
// embutida no card de link (457 BYTES — algo perto de 100px), a tentativa de
// buscar a foto oficial na loja não devolveu nada, e o último recurso
// ("imagem ruim > nenhuma imagem") publicou essa miniatura ampliada.
//
// "Imagem ruim > nenhuma imagem" continua valendo para uma miniatura decente,
// mas não para uma que vira borrão: nesse caso o WhatsApp faz melhor sozinho —
// sem imagem, o envio degrada para o card de link automático, que fica legível.
// O piso é em BYTES porque é o único sinal disponível de graça neste ponto do
// pipeline (o buffer ainda não foi decodificado); miniatura de card de link
// costuma ter 3-20KB, e o caso patológico deste RCA tinha 457 bytes.

// 800 e não 3000 (hotfix 2026-08-26, mesmo dia): o piso entrou em 3000 por
// analogia ("miniatura de card costuma ter 3-20KB") e derrubou a imagem de
// MUITA oferta legítima — a cliente passou a receber oferta como texto pelado,
// que é pior que foto ruim. O caso patológico do RCA tinha 457 bytes; 800
// separa "não dá para ver nada" de "dá para ver, mal". Piso é rede contra o
// borrão extremo, não critério de qualidade.
export const DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES = 800

export function resolveMinPublishableImageBytes(env = process.env) {
  const raw = env?.MONITORED_MIN_IMAGE_BYTES
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES
  // `0` é escape hatch explícito: volta ao comportamento histórico (publica
  // qualquer miniatura, por pior que seja).
  return Math.floor(parsed)
}

/**
 * @returns {{ publish: boolean, bytes: number, minBytes: number }}
 */
export function isPublishableFallbackImage(image, minBytes = DEFAULT_MIN_PUBLISHABLE_IMAGE_BYTES) {
  const bytes = image?.buffer?.length ?? 0
  const floor = Number.isFinite(minBytes) && minBytes > 0 ? minBytes : 0
  if (!bytes) return { publish: false, bytes: 0, minBytes: floor }
  if (!floor) return { publish: true, bytes, minBytes: floor }
  return { publish: bytes >= floor, bytes, minBytes: floor }
}
