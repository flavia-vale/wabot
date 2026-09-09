// Carregador em LOTE de "o número desta conta também está em outra conta".
// Duas consultas por lista, nunca uma por linha — mesma disciplina de
// `payingLoader.js`.

/**
 * @returns {Promise<Map<string, number>>} userId → em quantas contas o número
 *   dele aparece (contando a dele). Contas sem número ficam de fora do mapa.
 */
export async function loadSharedPhoneCounts(db, userIds = []) {
  const ids = [...new Set((userIds ?? []).filter(Boolean))]
  if (!db?.waPhoneOwnership?.findMany || !ids.length) return new Map()
  try {
    const meus = await db.waPhoneOwnership.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, phone: true },
    })
    if (!meus.length) return new Map()

    const phones = [...new Set(meus.map(row => row.phone).filter(Boolean))]
    // Agregação no banco: volta um número por telefone, não a tabela inteira.
    const contagem = await db.waPhoneOwnership.groupBy({
      by: ['phone'],
      where: { phone: { in: phones } },
      _count: { _all: true },
    })
    const porTelefone = new Map(contagem.map(row => [row.phone, Number(row._count?._all ?? 0)]))

    // Uma conta pode ter ligado vários números; vale o pior caso, que é o que
    // a pessoa que decide precisa ver primeiro.
    const porUsuario = new Map()
    for (const row of meus) {
      const contas = porTelefone.get(row.phone) ?? 0
      const atual = porUsuario.get(row.userId) ?? 0
      if (contas > atual) porUsuario.set(row.userId, contas)
    }
    return porUsuario
  } catch {
    // Falha aqui não pode derrubar a listagem: sem o dado, ninguém recebe tag.
    return new Map()
  }
}
