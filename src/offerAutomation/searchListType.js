// De qual lista da Shopee os candidatos saem — decidido em UM lugar só.
//
// A `productOfferV2` tem dois eixos: `listType` (de qual lista tirar) e
// `sortType` (em que ordem devolver). Só o segundo muda o resultado.
//
// MEDIDO em produção com a chave real (`scripts/diag-busca-shopee.mjs`,
// 2026-09-17), CINCO palavras-chave, cada uma nas três listas:
//
//   eletrodoméstico Brastemp   50 → 45 / 45 / 45   mesmos produtos, mesma ordem
//   maquina de lavar Brastemp  50 → 47 / 47 / 47   idem
//   fone de ouvido bluetooth   50 → 49 / 49 / 49   idem
//   air fryer                  50 → 43 / 43 / 43   idem
//   perfume importado          50 → 48 / 48 / 48   idem
//
// Ou seja: `listType` não filtrou NADA em nenhuma delas. Manter o campo na
// tela obrigava a cliente a decidir algo que não muda o resultado — e, pior,
// desviava a atenção da ordem, que é o que de fato separa o produto do
// acessório (capa 43% de comissão contra máquina 4-7%).
//
// Por que 0 e não o histórico 1: **0 é o único valor que a Shopee documenta**
// ("todos"). O 1 não aparece na documentação pública em lugar nenhum — foi
// escolhido no olho quando `listType=2` se mostrou estreito demais (ver o
// comentário de `shopeeOffers.js`). Com as duas listas provadas equivalentes,
// ficar no valor documentado é o que dá para defender.
//
// O valor gravado em `OfferAutomation.listType` continua no banco e é
// IGNORADO no envio — mesmo padrão de `Group.imageMode`: coluna dormente, sem
// migration, reversível apagando uma linha do `.env`.

export const DEFAULT_SEARCH_LIST_TYPE = 0

// Valores que a API aceita. Fora disso ela recusa a consulta inteira, então
// `.env` mal preenchido cai no padrão em vez de derrubar toda automação.
const ACEITOS = new Set([0, 1, 2, 3, 4, 5])

/**
 * @param {string|undefined} raw normalmente `process.env.OFFER_SEARCH_LIST_TYPE`
 * @returns {number} a lista que TODA busca de oferta automática usa
 */
export function resolveSearchListType(raw = process.env.OFFER_SEARCH_LIST_TYPE) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_SEARCH_LIST_TYPE
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || !ACEITOS.has(parsed)) return DEFAULT_SEARCH_LIST_TYPE
  return parsed
}
