// Feature 017, Fatia 3 (T062) — PURO. Decide o que sai da caixa de saída
// neste tick e o que espera (FR-039/FR-040/SC-013):
// - rodízio entre contas: cada conta tem um teto por tick, então uma conta em
//   volume alto não toma a vez das outras;
// - no máximo UMA entrega por destino por tick (ritmo por grupo do
//   aplicativo; com tick de 5 s isso fica abaixo de ~20/min por grupo);
// - orçamento global do robô por tick: o que passar recebe `notBeforeAt` no
//   futuro e continua `pending` — adiar NUNCA é descartar.
// Sem orçamento conhecido (null/inválido), sai no ritmo conservador (1 por
// conta), nunca trava a conta inteira.

export function planOutboxTick(rows = [], { perUserCap = 5, globalBudget = null, now = Date.now(), retryInMs = 5_000 } = {}) {
  const budget = Number.isFinite(globalBudget) && globalBudget >= 0 ? globalBudget : null
  const userCap = budget === null ? 1 : Math.max(1, perUserCap)

  // Fila por conta, preservando a ordem de chegada dentro de cada conta.
  const byUser = new Map()
  for (const row of [...rows].sort((a, b) => Number(new Date(a.enqueuedAt)) - Number(new Date(b.enqueuedAt)))) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, [])
    byUser.get(row.userId).push(row)
  }

  const send = []
  const deferred = []
  const usedDestinations = new Set()
  const takenPerUser = new Map()
  let progressed = true

  // Rodízio: uma por conta por volta, até o teto da conta ou o orçamento.
  while (progressed) {
    progressed = false
    for (const [userId, queue] of byUser) {
      if ((takenPerUser.get(userId) ?? 0) >= userCap) continue
      const index = queue.findIndex((row) => !usedDestinations.has(row.destinationId))
      if (index === -1) continue
      const [row] = queue.splice(index, 1)
      if (budget !== null && send.length >= budget) {
        deferred.push({ row, notBeforeAt: new Date(now + retryInMs) })
        continue
      }
      send.push(row)
      usedDestinations.add(row.destinationId)
      takenPerUser.set(userId, (takenPerUser.get(userId) ?? 0) + 1)
      progressed = true
    }
  }

  return { send, deferred }
}
