/**
 * Cadeado de posse no Redis (SUPERVISOR_OWNER_LEASE, default off).
 *
 * É uma SEGUNDA barreira contra o mesmo WhatsApp ligado em dois nós (dois
 * sockets na mesma credencial = queda em loop / risco de bloqueio). NUNCA é a
 * fonte da verdade — quem manda é `WaSession.nodeId`. Por isso falha ABERTO:
 * se o Redis não responde, o cadeado não bloqueia (o banco já decidiu), e o
 * erro é só logado. Redis fora = perder a guarda extra, nunca perder o robô.
 */

import { OWNER_LEASE_TTL_SECONDS, ownerLeaseKey } from './protocol.js'

export function createOwnerLease({ redis, nodeId, ttlSeconds = OWNER_LEASE_TTL_SECONDS, logger = null } = {}) {
  if (!redis) throw new Error('createOwnerLease: redis obrigatório')
  if (!nodeId) throw new Error('createOwnerLease: nodeId obrigatório')

  return {
    /** @returns {Promise<{ok:boolean, holder:string|null, degraded?:boolean}>} */
    async acquire(userId) {
      const key = ownerLeaseKey(userId)
      try {
        const set = await redis.set(key, nodeId, 'EX', ttlSeconds, 'NX')
        if (set === 'OK') return { ok: true, holder: nodeId }
        const holder = await redis.get(key)
        if (holder === nodeId || holder === null) {
          await redis.set(key, nodeId, 'EX', ttlSeconds)
          return { ok: true, holder: nodeId }
        }
        return { ok: false, holder }
      } catch (err) {
        logger?.warn?.({ userId, err: err?.message }, 'cadeado de posse indisponível — seguindo só com a posse do banco')
        return { ok: true, holder: null, degraded: true }
      }
    },
    /** Renova só o que é nosso; nunca toma cadeado de outro nó. */
    async renew(userId) {
      const key = ownerLeaseKey(userId)
      try {
        const holder = await redis.get(key)
        if (holder !== null && holder !== nodeId) return { ok: false, holder }
        await redis.set(key, nodeId, 'EX', ttlSeconds)
        return { ok: true, holder: nodeId }
      } catch (err) {
        logger?.warn?.({ userId, err: err?.message }, 'falha ao renovar cadeado de posse')
        return { ok: true, holder: null, degraded: true }
      }
    },
    /** Solta só se for nosso (STOP_BOT / shutdown). */
    async release(userId) {
      const key = ownerLeaseKey(userId)
      try {
        if ((await redis.get(key)) === nodeId) await redis.del(key)
      } catch (err) {
        logger?.warn?.({ userId, err: err?.message }, 'falha ao soltar cadeado de posse')
      }
    },
  }
}
