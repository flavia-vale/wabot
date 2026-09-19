const ATTENTION_PUBLICATION_STATUSES = ['failed', 'reconciliation_required']

export async function getInstagramHealth(userId, { db, now = () => new Date() } = {}) {
  const staleBefore = new Date(now().getTime() - 15 * 60_000)
  const [connections, queued, processing, published, failed, reconciliation, ingressPending, ingressFailed, staleIngress] = await Promise.all([
    db.instagramConnection.count({ where: { userId, status: 'connected' } }),
    db.storyPublication.count({ where: { userId, status: { in: ['queued', 'retry_scheduled'] } } }),
    db.storyPublication.count({ where: { userId, status: { in: ['processing', 'container_processing'] } } }),
    db.storyPublication.count({ where: { userId, status: 'published' } }),
    db.storyPublication.count({ where: { userId, status: 'failed' } }),
    db.storyPublication.count({ where: { userId, status: 'reconciliation_required' } }),
    db.instagramStoryIngress.count({ where: { userId, status: 'pending' } }),
    db.instagramStoryIngress.count({ where: { userId, status: 'failed' } }),
    db.instagramStoryIngress.count({ where: { userId, status: 'processing', claimedAt: { lt: staleBefore } } }),
  ])
  return {
    connections,
    publications: { queued, processing, published, failed, reconciliation },
    mirroring: { pending: ingressPending, failed: ingressFailed, stale: staleIngress },
    requiresAttention: failed + reconciliation + ingressFailed + staleIngress,
    attentionStatuses: ATTENTION_PUBLICATION_STATUSES,
    checkedAt: now().toISOString(),
  }
}
