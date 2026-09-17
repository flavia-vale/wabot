const DEFAULT_EXIT_TIMEOUT_MS = 15_000
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 45_000

async function safeUpdate(db, userId, data) {
  return db.waSession.update({ where: { userId }, data })
}

async function claimLifecycle(db, session, lifecycle) {
  if (typeof db.waSession.updateMany !== 'function') {
    await safeUpdate(db, session.userId, { lifecycle })
    return true
  }
  const result = await db.waSession.updateMany({
    where: { userId: session.userId, lifecycle: session.lifecycle, ownerInstance: session.ownerInstance },
    data: { lifecycle },
  })
  return result.count === 1
}

/** Orquestra handoff sem permitir que dedicado e shard abram juntos. */
export function createShardOwnershipCoordinator({ db, dedicated, shard, logger = console, now = () => new Date() }) {
  if (!db?.waSession || !dedicated || !shard) throw new Error('Dependências de ownership incompletas')

  async function moveToShard({ userId, shardId, exitTimeoutMs = DEFAULT_EXIT_TIMEOUT_MS, heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS }) {
    const owner = `shard:${shardId}`
    const session = await db.waSession.findUnique({ where: { userId } })
    if (!session) throw new Error('Sessão não encontrada')
    if (session.ownerInstance === owner && await shard.isRunning(userId)) return { moved: false, idempotent: true, owner }
    if (String(session.lifecycle).startsWith('moving')) throw new Error('Sessão já está em transferência')
    if (!(await claimLifecycle(db, session, 'moving_to_shard'))) throw new Error('Ownership mudou durante o pre-flight; transferência cancelada')
    try {
      dedicated.block?.(userId)
      await dedicated.drain?.(userId)
      await dedicated.stop(userId)
      const exited = await dedicated.waitForExit(userId, exitTimeoutMs)
      if (!exited || await dedicated.isRunning(userId)) throw new Error('Worker dedicado não confirmou exit; shard não será iniciado')
      await shard.start(userId)
      const alive = await shard.waitForHeartbeat(userId, heartbeatTimeoutMs)
      if (!alive) throw new Error('Shard não confirmou heartbeat')
      await safeUpdate(db, userId, { ownerInstance: owner, lifecycle: 'ready', status: 'connected', lastHeartbeatAt: now() })
      dedicated.unblock?.(userId)
      return { moved: true, owner }
    } catch (error) {
      logger.error?.({ userId, shardId, err: error?.message }, 'Falha no handoff para shard')
      try { await shard.stop(userId) } catch {}
      try { if (!(await dedicated.isRunning(userId))) await dedicated.start(userId) } catch {}
      dedicated.unblock?.(userId)
      await safeUpdate(db, userId, { lifecycle: 'reconnecting' })
      throw error
    }
  }

  async function rollback({ userId, shardId, dedicatedOwner, heartbeatTimeoutMs = DEFAULT_HEARTBEAT_TIMEOUT_MS }) {
    const session = await db.waSession.findUnique({ where: { userId } })
    if (!session) throw new Error('Sessão não encontrada')
    const shardOwner = `shard:${shardId}`
    if (session.ownerInstance !== shardOwner && await dedicated.isRunning(userId)) {
      await safeUpdate(db, userId, { lifecycle: 'ready', status: 'connected', ownerInstance: dedicatedOwner, lastHeartbeatAt: now() })
      return { restored: false, idempotent: true, owner: dedicatedOwner }
    }
    if (!(await claimLifecycle(db, session, 'restoring_dedicated'))) throw new Error('Ownership mudou durante o rollback; reconcilie antes de repetir')
    dedicated.block?.(userId)
    try {
      await shard.drain(userId)
      await shard.stop(userId)
      if (await shard.isRunning(userId)) throw new Error('Socket do shard ainda está ativo')
      if (!(await dedicated.isRunning(userId))) await dedicated.start(userId)
      const alive = await dedicated.waitForHeartbeat(userId, heartbeatTimeoutMs)
      if (!alive) throw new Error('Worker dedicado não confirmou heartbeat no rollback')
      await safeUpdate(db, userId, { ownerInstance: dedicatedOwner, lifecycle: 'ready', status: 'connected', lastHeartbeatAt: now() })
      return { restored: true, owner: dedicatedOwner }
    } finally {
      dedicated.unblock?.(userId)
    }
  }

  async function rollbackMany({ members, shardId, dedicatedOwner }) {
    const results = []
    for (const member of members) {
      try { results.push({ userId: member.userId, ok: true, result: await rollback({ userId: member.userId, shardId, dedicatedOwner: member.dedicatedOwner || dedicatedOwner }) }) }
      catch (error) { results.push({ userId: member.userId, ok: false, error: error?.message || String(error) }) }
    }
    return { ok: results.every(result => result.ok), results }
  }

  return { moveToShard, rollback, rollbackMany }
}
