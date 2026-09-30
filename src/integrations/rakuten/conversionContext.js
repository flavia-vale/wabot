// Monta o que a conversão de links da Rakuten precisa para UMA cliente: contas
// com o `id` dos links dela (linkId) e lojas aprovadas → matcher. Usado pelo
// robô (loadConfig, relido a cada minuto) e pelas rotas de "Converter links" /
// "Criar oferta". Mesmo desenho de src/integrations/awin/conversionContext.js.
//
// Sem conta Rakuten utilizável → null: detector, sanitizador e conversão ficam
// exatamente como antes (nenhuma loja nova reconhecida). Conta sem linkId
// (ainda não houve promoção no sync) não converte — não dá para montar o link.
// Sem nenhuma loja aprovada guardada → null também.
//
// Nada de segredo aqui: o deep link não usa token (montado sem chamada).
// Memória: poucas dezenas de lojas × 1 domínio por cliente (KB).

import dbDefault from '../../db.js'
import { RAKUTEN_ACCOUNT_STATUS } from './accountService.js'
import { createRakutenStoreMatcher, isValidRakutenLinkId } from './storeMatcher.js'

function parseDomains(json) {
  try {
    const list = JSON.parse(json || '[]')
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export async function loadRakutenConversionContext(userId, deps = {}) {
  const db = deps.db ?? dbDefault
  if (!userId) return null
  const accounts = await db.rakutenAccount.findMany({
    where: { userId, status: { not: RAKUTEN_ACCOUNT_STATUS.INVALID_CREDENTIAL }, linkId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, linkId: true },
  })
  const accountsById = new Map()
  for (const account of accounts) {
    if (isValidRakutenLinkId(account.linkId)) accountsById.set(account.id, { id: account.id, linkId: account.linkId })
  }
  if (!accountsById.size) return null

  const programmes = await db.rakutenProgramme.findMany({
    where: { userId, accountId: { in: [...accountsById.keys()] } },
    select: { accountId: true, advertiserId: true, name: true, domainsJson: true },
  })
  // Mesma loja em duas contas: vale a conta cadastrada primeiro.
  const accountOrder = new Map([...accountsById.keys()].map((id, index) => [id, index]))
  programmes.sort((a, b) => (accountOrder.get(a.accountId) - accountOrder.get(b.accountId)) || String(a.advertiserId).localeCompare(String(b.advertiserId)))
  const stores = programmes.map((row) => ({
    accountId: row.accountId,
    linkId: accountsById.get(row.accountId).linkId,
    advertiserId: String(row.advertiserId),
    name: row.name,
    domains: parseDomains(row.domainsJson),
  }))
  // Sem loja aprovada guardada (sync ainda não leu a lista, ou o formato
  // mudou) → null, igual a sem conta: o link da Rakuten é apagado como antes,
  // em vez de a oferta travar por "cadastro incompleto".
  if (!stores.length) return null
  const linkIds = [...accountsById.values()].map((account) => account.linkId)

  const context = {
    userId,
    accountsById,
    linkIds: new Set(linkIds),
    stores,
    matcher: createRakutenStoreMatcher(stores, { linkIds }),
  }
  Object.defineProperty(context, 'toJSON', { enumerable: false, value: () => ({ userId, accounts: accountsById.size, stores: stores.length }) })
  return context
}

/** Opções do detector/sanitizador para esta cliente ({} sem Rakuten). */
export function rakutenOfferOptions(context) {
  return context?.matcher ? { rakuten: context.matcher } : {}
}
