// Como as lojas com código vencido são DESCRITAS no aviso. Puro.
//
// O texto do e-mail vive no catálogo (src/email/registry.js, slug
// `codigo_acesso_venceu`) para a admin poder editar pelo painel; o que muda por
// loja entra como variável, montada aqui.

export const EXPIRY_TEMPLATE_SLUG = 'codigo_acesso_venceu'

const STORE_LABELS = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
}

// O que muda, na prática, em cada loja. Só o Mercado Livre perde a conversão de
// cupom sem produto; na Amazon o resto continua igual.
const STORE_EFFECTS = {
  mercadolivre: 'no Mercado Livre, o cupom que não aponta para um produto deixa de ser convertido',
  amazon: 'na Amazon, tudo o mais continua igual',
}

function joinFriendly(items = []) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/**
 * @param {string[]} platforms
 * @returns {{ lojas: string, consequencia: string }}
 */
export function describeExpiredStores(platforms = []) {
  const known = platforms.filter((platform) => STORE_LABELS[platform])
  return {
    lojas: joinFriendly(known.map((platform) => STORE_LABELS[platform])),
    consequencia: joinFriendly(known.map((platform) => STORE_EFFECTS[platform]).filter(Boolean)),
  }
}
