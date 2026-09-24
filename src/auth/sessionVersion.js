// Login que sobrevivia à troca de senha (auditoria 2026-09-23, ASVS V3.3.3).
//
// O token de login vale 7 dias e antes não sabia nada da senha: redefinir a
// senha por "esqueci" não derrubava sessão nenhuma, e a troca pelo painel só
// derrubava a sessão ATUAL. Quem tivesse roubado um token continuava entrando
// até ele vencer — justamente a situação em que a pessoa troca a senha.
//
// Sem migration: o token carrega `pv`, uma impressão curta do hash da senha. A
// troca de senha muda o hash, a impressão deixa de bater e todo token antigo
// cai de uma vez. Token emitido antes desta versão (sem `pv`) segue valendo até
// vencer — derrubar todo mundo no deploy seria pior que a janela de 7 dias.
import { createHash } from 'node:crypto'

export function passwordVersion(passwordHash) {
  if (!passwordHash) return null
  return createHash('sha256').update(`pv:${passwordHash}`).digest('hex').slice(0, 16)
}

// Cache curto para não ler a senha do banco a cada pedido. `invalidate` é
// chamado na troca de senha, então no próprio processo a queda é imediata; o
// TTL só limita quanto tempo uma troca feita por fora (banco) demora a valer.
export function createSessionVersionCache({ loadPasswordHash, ttlMs = 60_000, maxEntries = 50_000, now = Date.now } = {}) {
  const entries = new Map()

  async function current(userId) {
    const hit = entries.get(userId)
    if (hit && now() - hit.at < ttlMs) return hit.version
    const version = passwordVersion(await loadPasswordHash(userId))
    entries.delete(userId)
    entries.set(userId, { version, at: now() })
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value)
    return version
  }

  return {
    async matches(userId, tokenVersion) {
      if (!tokenVersion) return true
      return (await current(userId)) === tokenVersion
    },
    invalidate(userId) {
      entries.delete(userId)
    },
  }
}

// Token de outro propósito (ticket do QR, `state` do OAuth) assina com o mesmo
// segredo e NÃO pode passar como login.
export function isLoginToken(payload) {
  return Boolean(payload?.sub) && !payload.purpose && !payload.p
}
