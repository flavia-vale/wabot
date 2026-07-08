export function createReloadConfigHandler({ belongsToThisShard, sessionCore, logger }) {
  return async function handleReloadConfig({ userId }) {
    const startedAt = Date.now()
    if (!belongsToThisShard(userId)) {
      logger?.warn?.({ userId, belongsToThisShard: false, durationMs: Date.now() - startedAt }, 'Supervisor reloadConfig ignorado: usuário pertence a outro shard')
      return false
    }

    const workerFound = Boolean(sessionCore.reloadConfig(userId))
    const payload = { userId, belongsToThisShard: true, workerFound, durationMs: Date.now() - startedAt }
    if (workerFound) {
      logger?.info?.(payload, 'Supervisor reloadConfig aplicado')
    } else {
      logger?.warn?.(payload, 'Supervisor reloadConfig sem worker ativo')
    }
    return workerFound
  }
}
