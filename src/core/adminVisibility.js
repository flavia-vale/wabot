// O que o painel admin mostra POR PADRÃO.
//
// Pedido da dona do produto (2026-08-26): conta vencida há muito tempo polui a
// visão e esconde o que precisa de decisão hoje. A medição do dia deu a
// dimensão: de 66 contas desconectadas, 57 estavam com o acesso vencido — e
// 28 delas havia mais de 30 dias. Quem trabalha na tela procurava 9 casos
// reais no meio de 66 linhas.
//
// A regra é de APRESENTAÇÃO, nunca de dado: a conta continua no banco, continua
// contando em faturamento e continua acessível com um clique em "Ver mais".
// Esconder por padrão é diferente de sumir.
//
// Puro: sem I/O, sem relógio implícito.

export const DEFAULT_LONG_EXPIRED_DAYS = 30

export function resolveLongExpiredDays(value = process.env.ADMIN_HIDE_EXPIRED_AFTER_DAYS) {
  const days = Number(value)
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_LONG_EXPIRED_DAYS
}

// Aceita o parâmetro em várias formas porque ele vem de query string.
export function wantsLongExpired(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'sim' || raw === 'yes'
}

// Fragmento Prisma que EXCLUI quem venceu há mais que a janela. Devolve `null`
// quando não há nada a filtrar (a chamada usa isso para não montar AND à toa).
//
// Conta sem data de acesso NUNCA é escondida: "não sei quando vence" não é o
// mesmo que "venceu há muito tempo", e sumir com ela por dúvida esconderia
// justamente o caso estranho que alguém precisa olhar.
export function buildLongExpiredWhere({ now = new Date(), days, includeLongExpired = false } = {}) {
  if (includeLongExpired) return null
  const janela = resolveLongExpiredDays(days)
  const corte = new Date(new Date(now).getTime() - janela * 24 * 60 * 60 * 1000)
  return { OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: corte } }] }
}

// Mesma decisão, para listas já carregadas em memória.
export function isLongExpired(accessExpiresAt, { now = Date.now(), days } = {}) {
  if (accessExpiresAt == null) return false
  const venceuEm = new Date(accessExpiresAt).getTime()
  if (!Number.isFinite(venceuEm)) return false
  return venceuEm <= new Date(now).getTime() - resolveLongExpiredDays(days) * 24 * 60 * 60 * 1000
}
