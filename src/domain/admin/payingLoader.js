// Carregador em LOTE de "quem já pagou". Uma consulta por lista, nunca uma por
// linha — mesma disciplina do resto dos agregados do admin.
//
// `groupBy` em vez de `findMany`: a agregação acontece no SQLite e o que volta
// é um id por cliente, não a tabela de pagamentos inteira.

const APPROVED_PAYMENT_STATUSES = ['approved']

export async function loadEverPaidUserIds(db, userIds = []) {
  const ids = [...new Set((userIds ?? []).filter(Boolean))]
  if (!db?.payment?.groupBy || !ids.length) return new Set()
  try {
    const rows = await db.payment.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, status: { in: APPROVED_PAYMENT_STATUSES } },
      _count: { _all: true },
    })
    return new Set(rows.map(row => row.userId).filter(Boolean))
  } catch {
    // Falha aqui não pode derrubar a listagem: sem o dado, ninguém recebe a
    // tag (falta de tag é ausência de informação, tag errada é informação
    // falsa — e a segunda é pior).
    return new Set()
  }
}
