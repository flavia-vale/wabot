// Registro e leitura do histórico "quem já conectou este número".
//
// A REGRA mora em `phoneReuse.js` (pura). Aqui só gravamos e buscamos, com o
// banco injetado — o worker importa isto, e nada disto pode derrubar a sessão:
// todo caminho é best-effort e falha em silêncio para o lado de DEIXAR
// CONECTAR (invariante 3 do módulo puro).

import { normalizeWaPhone } from './phoneReuse.js'

/** Teto de contas anteriores lidas — a decisão é qualitativa, não um relatório. */
const MAX_ANTERIORES = 20

/**
 * Marca que esta conta conectou este número. Idempotente: o mesmo par só
 * atualiza a data da última conexão, então reconectar não polui o histórico.
 */
export async function recordPhoneOwnership({ db, userId, phone, now = new Date() } = {}) {
  const numero = normalizeWaPhone(phone)
  if (!db || !userId || !numero) return { gravado: false }
  await db.waPhoneOwnership.upsert({
    where: { phone_userId: { phone: numero, userId } },
    update: { lastConnectedAt: now },
    create: { phone: numero, userId, firstConnectedAt: now, lastConnectedAt: now },
  })
  return { gravado: true, phone: numero }
}

/**
 * Contas ANTERIORES que já conectaram este número (sem a atual).
 *
 * Traz `paid` de verdade — a partir de pagamento aprovado, nunca do campo
 * `plan`, que liberação manual e trial também escrevem. É a mesma regra da tag
 * "Pagante" do admin, e é o que separa "teste repetido" de "cliente voltando".
 */
export async function loadPreviousPhoneOwners({ db, phone, currentUserId } = {}) {
  const numero = normalizeWaPhone(phone)
  if (!db || !numero) return []

  const donos = await db.waPhoneOwnership.findMany({
    where: { phone: numero, ...(currentUserId ? { userId: { not: currentUserId } } : {}) },
    select: { userId: true, firstConnectedAt: true },
    orderBy: { firstConnectedAt: 'asc' },
    take: MAX_ANTERIORES,
  })
  if (!donos.length) return []

  const ids = donos.map(d => d.userId)
  const [usuarios, pagamentos] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, plan: true } }),
    db.payment.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: 'approved' }, _count: { _all: true } }).catch(() => []),
  ])
  const pagantes = new Set(pagamentos.map(p => p.userId))
  const porId = new Map(usuarios.map(u => [u.id, u]))

  return donos.map(d => {
    const u = porId.get(d.userId)
    return {
      userId: d.userId,
      email: u?.email ?? null,
      plan: u?.plan ?? null,
      // Regra da casa: quem pagou sai de pagamento APROVADO, nunca do campo
      // `plan` — liberação manual e trial também escrevem esse campo, e usá-lo
      // pintaria de pagante quem nunca pagou.
      paid: pagantes.has(d.userId),
      firstConnectedAt: d.firstConnectedAt,
    }
  })
}
