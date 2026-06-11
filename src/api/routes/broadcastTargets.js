import { detectKind, ensureJid, JID_KIND } from '../../core/jid.js'
import { buildFeatureGateError, canUseChannels } from '../../billing/plans.js'

export const MAX_BROADCAST_TARGETS = Math.max(1, Number(process.env.MAX_BROADCAST_TARGETS || 50))
export const MAX_BROADCAST_TEXT_CHARS = Math.max(1, Number(process.env.MAX_BROADCAST_TEXT_CHARS || 12_000))

export function normalizeTargetJids(jids) {
  const input = Array.isArray(jids) ? jids : []
  return [...new Set(input.map((jid) => {
    const normalized = ensureJid(jid, JID_KIND.GROUP)
    if (!normalized) return null
    return detectKind(normalized) === JID_KIND.CHANNEL ? ensureJid(jid, JID_KIND.CHANNEL) : normalized
  }).filter(Boolean))]
}

function badRequest(message) {
  const err = new Error(message)
  err.statusCode = 400
  return err
}

async function loadOwnedPostJidSet(db, userId) {
  const postGroups = await db.group.findMany({ where: { userId, role: 'post' } })
  return new Set(normalizeTargetJids(postGroups.map((group) => group.waJid)))
}

// JIDs explícitos enviados pelo cliente são validados contra os grupos de
// destino CADASTRADOS do próprio tenant. Sem isso, qualquer JID arbitrário
// vira destino de broadcast pela sessão do usuário — contorna a configuração,
// permite disparo em massa para grupos não autorizados e eleva o risco de ban
// do número.
export async function validateOwnedTargetJids({ db, userId, jids }) {
  const normalized = normalizeTargetJids(jids)
  if (!normalized.length) return normalized
  const owned = await loadOwnedPostJidSet(db, userId)
  const unknown = normalized.filter((jid) => !owned.has(jid))
  if (unknown.length) {
    throw badRequest(`Destino(s) não cadastrado(s) como grupo de destino: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? ` (+${unknown.length - 5})` : ''}. Cadastre o grupo em Grupos antes de enviar.`)
  }
  return normalized
}

export function validateBroadcastText(text) {
  if (typeof text === 'string' && text.length > MAX_BROADCAST_TEXT_CHARS) {
    throw badRequest(`Texto excede o limite de ${MAX_BROADCAST_TEXT_CHARS} caracteres`)
  }
}

export async function resolveTargetJids({ db, userId, jids }) {
  const targets = Array.isArray(jids) && jids.length
    ? await validateOwnedTargetJids({ db, userId, jids })
    : normalizeTargetJids((await db.group.findMany({ where: { userId, role: 'post' } })).map((group) => group.waJid))
  if (targets.length > MAX_BROADCAST_TARGETS) {
    throw badRequest(`Máximo de ${MAX_BROADCAST_TARGETS} destinos por envio (recebido: ${targets.length})`)
  }
  return targets
}

export async function loadUserPlanSubject(db, userId) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true, accessExpiresAt: true } })
  return user ?? { plan: 'basic', accessExpiresAt: null }
}

export function enforceChannelPlanGate(targetJids, planSubject) {
  if (canUseChannels(planSubject)) return null
  return targetJids.some((jid) => detectKind(jid) === JID_KIND.CHANNEL) ? buildFeatureGateError() : null
}
