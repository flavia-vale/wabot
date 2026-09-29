// Dados do pagador e do item que vão junto da preferência de pagamento avulso
// no Mercado Pago — módulo PURO.
//
// Por que existe (27/09/2026): `diag-assinatura-recusada --days=30` mostrou
// recusas do antifraude do MP ("rejected_high_risk") também em pagamento
// AVULSO no cartão — a mesma pessoa aprovava minutos depois. A preferência
// que criávamos não levava NADA do pagador (nem nome, nem e-mail, nem
// telefone) e o item ia sem id, descrição e categoria. A documentação do MP
// ("Melhorar a aprovação dos pagamentos") lista exatamente esses campos como
// insumo da análise de risco. Mandamos o que a conta já tem; nunca inventamos
// CPF nem endereço (não pedimos e não temos).

const PLAN_ITEM_DESCRIPTION = {
  basic: 'Espelha Grupos — plano Basic, 30 dias de acesso ao robô de ofertas para WhatsApp',
  pro: 'Espelha Grupos — plano Pro, 30 dias de acesso ao robô de ofertas para WhatsApp',
}

/**
 * Divide "Maria da Silva" em first_name/last_name como o MP espera. Um nome
 * só vira first_name e last_name iguais (o MP recusa last_name vazio em
 * algumas contas; repetir é o que o próprio checkout dele faz).
 */
export function splitPayerName(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

/**
 * Telefone brasileiro → { area_code, number }. Aceita "+55 (11) 91234-5678",
 * "5511912345678", "11912345678". Devolve null quando não dá para separar o
 * DDD com segurança — telefone errado piora a análise, não melhora.
 */
export function splitBrazilianPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (national.length < 10 || national.length > 11) return null
  return { area_code: national.slice(0, 2), number: national.slice(2) }
}

/**
 * @param {{ name?: string, email?: string, phone?: string|null }} user
 * @returns {null | { first_name?: string, last_name?: string, email?: string, phone?: { area_code: string, number: string } }}
 */
export function buildCheckoutPayer({ name, email, phone } = {}) {
  const payer = {}
  const nome = splitPayerName(name)
  if (nome) Object.assign(payer, nome)
  const mail = String(email ?? '').trim()
  if (mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) payer.email = mail
  const tel = splitBrazilianPhone(phone)
  if (tel) payer.phone = tel
  return Object.keys(payer).length ? payer : null
}

/**
 * Item completo: id estável por plano, descrição e categoria "services".
 * `title` e `unit_price` continuam vindo do plano configurado no admin.
 */
export function buildCheckoutItem({ plan, title, price } = {}) {
  const id = String(plan ?? '').toLowerCase()
  return {
    id: `espelha-grupos-${id || 'plano'}`,
    title: String(title ?? '').trim(),
    description: PLAN_ITEM_DESCRIPTION[id] ?? `Espelha Grupos — plano ${title}, 30 dias de acesso`,
    category_id: 'services',
    quantity: 1,
    unit_price: Number(price),
    currency_id: 'BRL',
  }
}
