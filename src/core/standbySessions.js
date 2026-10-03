// Processos de prontidão (número reserva) a religar depois de restart/queda —
// docs/rca/multi-numero.md. Mesma regra de ressurreição do número ativo
// (sessionResurrectionPolicy), aplicada à linha de prontidão (WaExtraSession
// slot 2). Flag desligada ou conta sem número extra pago = lista vazia.
import { multiNumberEnabled } from '../domain/session/multiNumberFlag.js'
import { standbyProcessKey, STANDBY_PROCESS_SLOT } from '../domain/session/workerIdentity.js'
import { buildResurrectionWhere, shouldResurrectSession } from './sessionResurrectionPolicy.js'

export async function listResumableStandbySessions(db, { includeReconnecting = true, accountSessionWhere = null, env = process.env } = {}) {
  if (!multiNumberEnabled(env)) return []
  const rows = await db.waExtraSession.findMany({
    where: {
      AND: [
        buildResurrectionWhere({ includeReconnecting }),
        { slot: STANDBY_PROCESS_SLOT, user: { extraNumbers: { gt: 0 } } },
        // Multi-nó: a prontidão mora no mesmo nó do número ativo da conta.
        ...(accountSessionWhere ? [{ user: { waSession: { is: accountSessionWhere } } }] : []),
      ],
    },
    select: { userId: true, status: true, lifecycle: true },
  })
  return rows
    .filter(row => shouldResurrectSession({ ...row, includeReconnecting }))
    .map(row => ({ ...row, accountId: row.userId, userId: standbyProcessKey(row.userId), ownerInstance: null }))
}
