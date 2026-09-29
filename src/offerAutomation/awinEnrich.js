// Link curto + foto das promoções Awin, buscados SÓ na hora do envio e só
// para as promoções que vão sair (docs/rca/afiliados-awin.md).
//
// - Link curto: gerador oficial da Awin com `shorten: true` (tidd.ly),
//   https://help.awin.com/apidocs/generatelink — mesma comissão do link
//   comprido (`urlTracking`), que continua sendo o plano B.
// - Foto: lida da página da loja (`AwinPromotion.url`) pelo leitor que as
//   outras lojas já usam (fetchProductImage → og:image e camadas do HTML).
// - Resultado guardado na promoção: a mesma promoção não é buscada de novo.
//   Falhou? Só tenta outra vez depois de 24h (loja que bloqueia leitura ou
//   não aceita link curto não gasta chamada a cada envio).
// - Qualquer falha → a oferta sai como antes (link comprido, sem foto).
//   Nunca segura o envio.
//
// Fica FORA de awinOffers.js de propósito: aquele arquivo é importado pelo
// painel (Next) e não pode puxar o leitor de fotos, que é só do servidor.

import { decryptCredential } from '../credentialCrypto.js'
import { fetchProductImage } from '../converters/imageScrapers.js'
import { getDefaultAwinClient } from '../integrations/awin/client.js'

export const AWIN_ENRICH_RETRY_MS = 24 * 60 * 60_000

function httpsUrl(value) {
  const text = String(value ?? '').trim()
  if (!text || text.length > 2000) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function needsEnrich(row, nowMs) {
  if (row.shortUrl && row.imageUrl) return false
  if (!row.enrichedAt) return true
  return nowMs - new Date(row.enrichedAt).getTime() >= AWIN_ENRICH_RETRY_MS
}

// offers: saída de awinPromotionToOffer (tem awinPromotionId). Devolve as
// mesmas ofertas, com `offerLink` curto e `imageUrl` quando deu certo.
export async function enrichAwinOffers(offers, {
  db,
  userId,
  accountId,
  client = getDefaultAwinClient(),
  fetchImage = fetchProductImage,
  decrypt = decryptCredential,
  now = new Date(),
} = {}) {
  if (!offers?.length) return offers ?? []
  const ids = offers.map((offer) => offer.awinPromotionId).filter(Boolean)
  if (!ids.length) return offers
  const rows = await db.awinPromotion.findMany({
    where: { id: { in: ids }, userId, accountId },
    select: { id: true, url: true, advertiserId: true, shortUrl: true, imageUrl: true, enrichedAt: true },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))

  let account = null
  let token = null
  if (rows.some((row) => !row.shortUrl && needsEnrich(row, now.getTime()))) {
    account = await db.awinAccount.findFirst({ where: { id: accountId, userId }, select: { publisherId: true, tokenEncrypted: true, status: true } })
    // Código recusado: não adianta pedir link curto (sairia 401 de novo).
    if (account && account.status !== 'invalid_credential') {
      try { token = decrypt(account.tokenEncrypted) } catch { token = null }
    }
  }

  const result = []
  // Uma promoção por vez: o gerador de links divide o limite de chamadas do
  // token com o sync (o limitador do cliente segura o ritmo).
  for (const offer of offers) {
    const row = byId.get(offer.awinPromotionId)
    if (!row) { result.push(offer); continue }
    let shortUrl = httpsUrl(row.shortUrl)
    let imageUrl = httpsUrl(row.imageUrl)
    if (needsEnrich(row, now.getTime())) {
      const storeUrl = httpsUrl(row.url)
      const [linkResult, imageResult] = await Promise.all([
        !shortUrl && token && storeUrl
          ? client.generateLink(token, account.publisherId, { advertiserId: row.advertiserId, destinationUrl: storeUrl, shorten: true }).catch(() => null)
          : null,
        !imageUrl && storeUrl ? Promise.resolve().then(() => fetchImage(null, storeUrl)).catch(() => null) : null,
      ])
      shortUrl = shortUrl || httpsUrl(linkResult?.shortUrl)
      imageUrl = imageUrl || httpsUrl(imageResult)
      await db.awinPromotion.update({ where: { id: row.id }, data: { shortUrl, imageUrl, enrichedAt: now } }).catch(() => {})
    }
    result.push({
      ...offer,
      offerLink: shortUrl || offer.offerLink,
      imageUrl: imageUrl || null,
      // A foto vem da página da loja: é ela a "origem" para baixar a imagem.
      imageRefererUrl: httpsUrl(row.url) || null,
    })
  }
  return result
}
