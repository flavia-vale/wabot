// Troca o número que envia (docs/rca/multi-numero.md, Fase 1). Usado pela troca
// automática (src/jobs/numberFailover.js) e pelo botão "voltar para o número 1".
//
// Invariante: NUNCA dois processos no mesmo login do WhatsApp (440 em loop).
// Por isso a ordem é: (1) reivindica a troca no banco — só uma passada ganha;
// (2) marca as duas linhas como 'switching' — a religação automática não
// ressuscita nada no meio; (3) para os dois processos e ESPERA saírem;
// (4) só então inverte activeWaSlot; (5) liga os dois de novo. Se algum
// processo não sair a tempo, desiste e devolve as linhas para 'reconnecting'
// (o resume religa como estava, com o número ativo de antes).
import { buildSessionKey } from '../domain/session/sessionKey.js'
import { otherSlot, standbyProcessKey, STANDBY_PROCESS_SLOT } from '../domain/session/workerIdentity.js'
import { MOVING_NODE_LIFECYCLE } from '../supervisor/accountMove.js'

const SWITCHING = 'switching'

async function waitStopped(manager, keys, { timeoutMs, pollMs, sleep }) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const running = await Promise.all(keys.map(key => Promise.resolve(manager.isRunning(key)).catch(() => true)))
    if (!running.some(Boolean)) return true
    await sleep(pollMs)
  }
  return false
}

export async function switchActiveNumber({
  db,
  manager,
  userId,
  expectedActiveSlot,
  reason,
  minIntervalMs = 0,
  now = new Date(),
  timeoutMs = 30_000,
  pollMs = 500,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  logger = console,
} = {}) {
  const from = expectedActiveSlot
  const to = otherSlot(from)
  const cutoff = new Date(now.getTime() - minIntervalMs)

  // Revisão V1 (multi-servidor): conta mudando de servidor não troca de número —
  // a troca religaria os dois processos no servidor antigo durante a cópia do login.
  const session = await db.waSession.findUnique({ where: { userId }, select: { lifecycle: true } })
  if (session?.lifecycle === MOVING_NODE_LIFECYCLE) return { switched: false, reason: 'moving_node' }

  // (1) Reivindica: só passa quem ainda vê o mesmo número ativo e fora do intervalo.
  const claim = await db.user.updateMany({
    where: { id: userId, activeWaSlot: from, OR: [{ waSlotSwitchedAt: null }, { waSlotSwitchedAt: { lte: cutoff } }] },
    data: { waSlotSwitchedAt: now },
  })
  if (claim.count !== 1) return { switched: false, reason: 'not_claimed' }

  const activeKey = buildSessionKey(userId)
  const standbyKey = standbyProcessKey(userId)
  const markRows = (data) => Promise.all([
    db.waSession.updateMany({ where: { userId }, data }),
    db.waExtraSession.updateMany({ where: { userId, slot: STANDBY_PROCESS_SLOT }, data }),
  ])

  // (2) e (3)
  await markRows({ lifecycle: SWITCHING })
  await Promise.all([manager.stopBot(activeKey), manager.stopBot(standbyKey)].map(p => Promise.resolve(p).catch(() => false)))
  const stopped = await waitStopped(manager, [activeKey, standbyKey], { timeoutMs, pollMs, sleep })
  if (!stopped) {
    logger.error?.({ userId, from, to }, 'Troca de número cancelada: processo não saiu a tempo — devolvendo como estava')
    await markRows({ lifecycle: 'reconnecting', status: 'disconnected' }).catch(() => {})
    return { switched: false, reason: 'stop_timeout' }
  }

  // (4) Inverte o número ativo — guarda contra troca concorrente.
  const flip = await db.user.updateMany({ where: { id: userId, activeWaSlot: from }, data: { activeWaSlot: to } })
  if (flip.count !== 1) {
    await markRows({ lifecycle: 'reconnecting', status: 'disconnected' }).catch(() => {})
    return { switched: false, reason: 'race' }
  }

  // (5) As linhas trocam de dono: o número que estava de prontidão agora é o
  // ativo. Os telefones trocam de linha JUNTO — senão a prontidão (agora o
  // número antigo) se compararia com o próprio telefone e se desligaria como
  // "mesmo número", e o ativo reenviaria a mensagem de boas-vindas.
  const [activeRow, standbyRow] = await Promise.all([
    db.waSession.findUnique({ where: { userId }, select: { phone: true } }).catch(() => null),
    db.waExtraSession.findUnique({ where: { userId_slot: { userId, slot: STANDBY_PROCESS_SLOT } }, select: { phone: true } }).catch(() => null),
  ])
  const reset = { lifecycle: 'reconnecting', status: 'connecting', lastDisconnectCode: null, blockNotice: null }
  await Promise.all([
    db.waSession.updateMany({ where: { userId }, data: { ...reset, phone: standbyRow?.phone ?? null } }),
    db.waExtraSession.updateMany({ where: { userId, slot: STANDBY_PROCESS_SLOT }, data: { ...reset, phone: activeRow?.phone ?? null } }),
  ])
  await Promise.resolve(manager.startBot(activeKey)).catch(err => logger.error?.({ userId, err: err?.message }, 'Falha ao religar o número ativo após a troca'))
  await Promise.resolve(manager.startBot(standbyKey)).catch(err => logger.error?.({ userId, err: err?.message }, 'Falha ao religar a prontidão após a troca'))
  logger.warn?.({ userId, from, to, reason }, 'Número ativo trocado')
  return { switched: true, from, to, reason }
}
