// PR-5.E.3: score heurístico 0–100 de "quão suspeito esse canal está".
// Não bloqueia ação — só exibe pro cliente. Maior score = mais risco.
//
// Dimensões (peso):
//   40% postsPerFollower (saturado em 0.5 posts/follower/dia)
//   30% (1 - clickRate)  — sem cliques = mais provável fake/farm
//   30% (1 - diversity)  — 1 fonte só virando N destinos = farm clássico
//
// clickRate=null usa fallback neutro (0.5) para não punir canais sem
// tracker de afiliado ativo.

const POSTS_PER_FOLLOWER_CAP = 0.2
const DIVERSITY_TARGET = 5 // 5+ fontes distintas = totalmente diverso
const CLICK_RATE_HEALTHY = 0.05
const CLICK_RATE_FALLBACK = 0.5 // neutro quando não há dados

export function normPostsPerFollower(postsPerDay, followerCount) {
  if (!followerCount || followerCount <= 0) return 1
  const ratio = postsPerDay / followerCount
  return Math.min(1, ratio / POSTS_PER_FOLLOWER_CAP)
}

export function diversityScore(sourceDiversity) {
  // 1 fonte → 0 (nada de diversidade); satura em DIVERSITY_TARGET fontes.
  const n = Math.max(1, Number(sourceDiversity) || 1)
  return Math.min(1, (n - 1) / (DIVERSITY_TARGET - 1))
}

function clampInt(value, lo, hi) {
  if (Number.isNaN(value)) return lo
  return Math.max(lo, Math.min(hi, Math.round(value)))
}

export function computeScore({ postsPerDay, followerCount, clickRate, sourceDiversity }) {
  const pf = normPostsPerFollower(Number(postsPerDay) || 0, Number(followerCount) || 0)

  // clickRate normalizado: clickRate >= healthy threshold → 0 (saudável).
  // 0 cliques → 1 (ruim). null → fallback neutro.
  const cr = clickRate == null
    ? CLICK_RATE_FALLBACK
    : Math.max(0, 1 - (Number(clickRate) || 0) / CLICK_RATE_HEALTHY)

  const dv = diversityScore(sourceDiversity)

  const raw = 40 * pf + 30 * cr + 30 * (1 - dv)
  return clampInt(raw, 0, 100)
}

/**
 * Coleta dimensões do banco e devolve { score, breakdown }. Não persiste.
 * @param {string} groupId
 * @param {{ db: any, userId: string, days?: number }} opts
 */
export async function collectScoreInputs(groupId, opts) {
  const { db, userId, days = 7 } = opts
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const group = await db.group.findFirst({ where: { id: groupId, userId } })
  if (!group) return null

  const [postsCount, snapshot, targets] = await Promise.all([
    db.messageLog.count({
      where: { userId, destGroup: group.waJid, status: 'success', sentAt: { gte: since } },
    }),
    db.channelSnapshot.findFirst({
      where: { groupId },
      orderBy: { snapshotedAt: 'desc' },
    }),
    db.groupTarget.findMany({ where: { postId: groupId }, select: { monitorId: true } }),
  ])

  const postsPerDay = postsCount / days
  let followerCount = 0
  if (snapshot?.snapshotJson) {
    try {
      const parsed = JSON.parse(snapshot.snapshotJson)
      followerCount = Number(parsed?.subscribersCount ?? parsed?.subscriberCount ?? parsed?.followerCount ?? 0)
    } catch { /* ignore */ }
  }
  const sourceDiversity = new Set(targets.map(t => t.monitorId)).size

  return {
    postsPerDay,
    followerCount,
    clickRate: null, // tracker de cliques fica para PR-5.C.4
    sourceDiversity,
  }
}

/**
 * Coleta + computa + persiste o score no ChannelHealth.
 */
export async function recomputeScore(groupId, opts) {
  const inputs = await collectScoreInputs(groupId, opts)
  if (!inputs) return null
  const score = computeScore(inputs)
  await opts.db.channelHealth.upsert({
    where: { groupId },
    create: { groupId, reportRiskScore: score },
    update: { reportRiskScore: score },
  })
  return { score, inputs }
}
