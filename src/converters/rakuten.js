// Conversor da Rakuten: link de loja aprovada (netshoes.com.br/...) ou link da
// Rakuten de outra pessoa (click.linksynergy.com/deeplink?...&murl=) → deep
// link da CLIENTE. Regras (docs/rca/afiliados-rakuten.md — não regredir):
//
// - Deep link montado aqui, SEM chamada à Rakuten (nada de cota, limite ou
//   espera): click.linksynergy.com/deeplink?id=<dela>&mid=<loja>&murl=<página>.
// - Nunca abre um link da Rakuten: o click.linksynergy.com conta o clique.
//   A página vem do `murl`; sem ele, o link não é convertível.
// - Loja em que a cliente NÃO foi aprovada → erro `stripFromMessage`: a
//   oferta não sai com o link de outra pessoa (core/mirrorLinkGuard.js).
// - Link que já é da cliente (id = uma das contas dela) fica como está.
// - Mesma loja na Awin e na Rakuten: quem decide é o detector (Awin primeiro,
//   decisão da dona do produto 2026-09-30); aqui só chega link já escolhido.
//
// `creds` vem de src/integrations/rakuten/conversionContext.js.

import {
  buildRakutenDeepLink,
  cleanRakutenDestinationUrl,
  isRakutenTrackingUrl,
  parseRakutenClickUrl,
} from '../integrations/rakuten/storeMatcher.js'

export const RAKUTEN_NOT_JOINED_ERROR = 'rakuten_store_not_joined'

function notConvertible(message, code) {
  const err = new Error(message)
  err.stripFromMessage = true
  err.rakutenReason = code
  return err
}

/**
 * Página da LOJA por trás de um link da Rakuten, para ler foto e nome. Nunca
 * abre o link de clique: usa o `murl`. Link que não é da Rakuten volta como
 * está. null = não dá para saber sem abrir o link (não abrimos).
 */
export function rakutenStorePageUrl(url) {
  if (!isRakutenTrackingUrl(url)) return url || null
  const destination = parseRakutenClickUrl(url)?.destinationUrl
  return destination ? cleanRakutenDestinationUrl(destination) : null
}

/**
 * @returns {Promise<{ url: string, rakuten: { own: boolean, advertiserId: string|null,
 *   storeName: string, destinationUrl: string|null } }>}
 */
export async function convert(url, creds, _options = {}) {
  const matcher = creds?.matcher
  const accounts = creds?.accountsById
  if (!matcher || !accounts?.size) throw notConvertible('Nenhuma conta Rakuten pronta para converter.', 'no_account')

  const click = parseRakutenClickUrl(url)
  if (isRakutenTrackingUrl(url) && !click) throw notConvertible('Link da Rakuten ilegível.', 'no_destination')

  // Já é link da cliente: não mexe.
  if (click?.linkId && matcher.ownLinkIds?.has(click.linkId)) {
    const store = (click.advertiserId && matcher.storeForAdvertiser(click.advertiserId))
      || (click.destinationUrl && matcher.storeForUrl(click.destinationUrl))
      || null
    return {
      url,
      rakuten: { own: true, advertiserId: store?.advertiserId ?? click.advertiserId, storeName: store?.name ?? '', destinationUrl: click.destinationUrl },
    }
  }

  const destinationUrl = cleanRakutenDestinationUrl(click ? click.destinationUrl : url)
  // Pela página primeiro; pelo `mid` só se a página for da mesma loja (R6).
  const store = typeof matcher.storeForClick === 'function'
    ? matcher.storeForClick({ advertiserId: click?.advertiserId ?? null, destinationUrl })
    : ((destinationUrl && matcher.storeForUrl(destinationUrl)) || (click?.advertiserId && matcher.storeForAdvertiser(click.advertiserId)) || null)
  if (!store) throw notConvertible('Loja da Rakuten em que você ainda não foi aprovada.', RAKUTEN_NOT_JOINED_ERROR)
  if (!destinationUrl) throw notConvertible('O link da Rakuten não diz para qual página da loja ele vai.', 'no_destination')
  const account = accounts.get(store.accountId)
  if (!account?.linkId) throw notConvertible('Conta Rakuten da loja não encontrada.', 'no_account')

  return {
    url: buildRakutenDeepLink({ linkId: account.linkId, advertiserId: store.advertiserId, destinationUrl }),
    rakuten: { own: false, advertiserId: store.advertiserId, storeName: store.name, destinationUrl },
  }
}
