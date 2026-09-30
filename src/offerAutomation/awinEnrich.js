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
// Foto: tentar de novo bem antes. Buscar foto não gasta cota da Awin, e a
// falha costuma ser passageira — com 24h, uma falha travava a promoção sem
// foto o dia inteiro (RCA 2026-09-30: 51 promoções da KaBuM).
export const AWIN_IMAGE_RETRY_MS = 60 * 60_000

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

function ageMs(row, nowMs) {
  return row.enrichedAt ? nowMs - new Date(row.enrichedAt).getTime() : Infinity
}

function needsShortUrl(row, nowMs) {
  return !row.shortUrl && ageMs(row, nowMs) >= AWIN_ENRICH_RETRY_MS
}

function needsImage(row, nowMs) {
  if (row.imageUrl) return false
  const tried = row.imageTriedAt ?? row.enrichedAt
  return !tried || nowMs - new Date(tried).getTime() >= AWIN_IMAGE_RETRY_MS
}

function needsEnrich(row, nowMs) {
  return needsShortUrl(row, nowMs) || needsImage(row, nowMs)
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
    select: { id: true, url: true, advertiserId: true, shortUrl: true, imageUrl: true, enrichedAt: true, imageTriedAt: true },
  })
  const byId = new Map(rows.map((row) => [row.id, row]))

  let account = null
  let token = null
  if (rows.some((row) => needsShortUrl(row, now.getTime()))) {
    account = await db.awinAccount.findFirst({ where: { id: accountId, userId }, select: { publisherId: true, tokenEncrypted: true, status: true } })
    // Código recusado: não adianta pedir link curto (sairia 401 de novo).
    if (account && account.status !== 'invalid_credential') {
      try { token = decrypt(account.tokenEncrypted) } catch { token = null }
    }
  }

  const logos = new Map()
  async function storeLogo(advertiserId) {
    // AwinPromotion guarda o id da loja como texto; AwinProgramme, como número.
    const id = Number(advertiserId)
    if (!Number.isSafeInteger(id) || id <= 0) return null
    if (!logos.has(id)) {
      const programme = await db.awinProgramme?.findFirst?.({ where: { userId, accountId, advertiserId: id }, select: { logoUrl: true } }).catch(() => null)
      logos.set(id, httpsUrl(programme?.logoUrl))
    }
    return logos.get(id)
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
        needsShortUrl(row, now.getTime()) && token && storeUrl
          ? client.generateLink(token, account.publisherId, { advertiserId: row.advertiserId, destinationUrl: storeUrl, shorten: true }).catch(() => null)
          : null,
        needsImage(row, now.getTime()) && storeUrl ? Promise.resolve().then(() => fetchImage(null, storeUrl)).catch(() => null) : null,
      ])
      shortUrl = shortUrl || httpsUrl(linkResult?.shortUrl)
      imageUrl = imageUrl || httpsUrl(imageResult)
      const triedLink = needsShortUrl(row, now.getTime())
      const triedImage = needsImage(row, now.getTime())
      await db.awinPromotion.update({
        where: { id: row.id },
        data: {
          shortUrl,
          imageUrl,
          ...(triedLink || !row.enrichedAt ? { enrichedAt: now } : {}),
          ...(triedImage ? { imageTriedAt: now } : {}),
        },
      }).catch(() => {})
    }
    // Última camada: logo da loja (Awin /programmes). NÃO é gravada como foto
    // da promoção — a foto do produto continua sendo tentada a cada hora.
    const logoUrl = imageUrl ? null : await storeLogo(row.advertiserId)
    result.push({
      ...offer,
      offerLink: shortUrl || offer.offerLink,
      imageUrl: imageUrl || logoUrl || null,
      // A foto vem da página da loja: é ela a "origem" para baixar a imagem.
      imageRefererUrl: httpsUrl(row.url) || null,
    })
  }
  return result
}
