// Como as lojas com código vencido são DESCRITAS no aviso. Puro.
//
// O texto do e-mail vive no catálogo (src/email/registry.js, slug
// `codigo_acesso_venceu`) para a admin poder editar pelo painel; o que muda por
// loja entra como variável, montada aqui.

export const EXPIRY_TEMPLATE_SLUG = 'codigo_acesso_venceu'

// A Shopee tem e-mail PRÓPRIO, e isso não é preciosismo de redação: o texto de
// `codigo_acesso_venceu` promete que "suas ofertas CONTINUAM saindo" — verdade
// no ML e na Amazon, onde o plano B publica o link mais comprido. Na Shopee é
// MENTIRA: sem chave aceita, a conversão falha inteira, a oferta vira
// `skip:no_valid_conversions` e NADA é publicado; as ofertas automáticas param
// junto. Mandar o texto tranquilizador nesse caso faria a cliente ignorar um
// problema que está custando venda. Não fundir os dois e-mails.
export const SHOPEE_REJECTED_TEMPLATE_SLUG = 'chave_shopee_recusada'

// Lojas cujo aviso cabe no texto de "código de acesso venceu".
const SESSION_EXPIRY_PLATFORMS = ['mercadolivre', 'amazon']

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

/**
 * Quais e-mails mandar para o conjunto de lojas confirmadas como recusadas.
 * Puro: só decide slug + variáveis; quem envia é o sweep.
 *
 * ML e Amazon são agrupados num e-mail só (o texto já lida com duas lojas). A
 * Shopee sai em e-mail separado — ver o comentário de
 * SHOPEE_REJECTED_TEMPLATE_SLUG. Quando as três caem no mesmo dia, a cliente
 * recebe dois e-mails, e é o certo: as consequências são opostas.
 *
 * @param {string[]} platforms
 * @returns {Array<{ slug: string, platforms: string[], vars: Record<string,string> }>}
 */
export function buildExpiryAlerts(platforms = []) {
  const alerts = []

  const sessionStores = platforms.filter((platform) => SESSION_EXPIRY_PLATFORMS.includes(platform))
  if (sessionStores.length) {
    alerts.push({
      slug: EXPIRY_TEMPLATE_SLUG,
      platforms: sessionStores,
      vars: describeExpiredStores(sessionStores),
    })
  }

  if (platforms.includes('shopee')) {
    alerts.push({ slug: SHOPEE_REJECTED_TEMPLATE_SLUG, platforms: ['shopee'], vars: {} })
  }

  return alerts
}
