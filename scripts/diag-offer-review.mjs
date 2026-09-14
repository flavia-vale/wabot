#!/usr/bin/env node
import 'dotenv/config'
import db from '../src/db.js'
import { reviewDeliveryEnabled, reviewFeatureEnabled } from '../src/offerAutomation/reviewFlags.js'

try {
  const [automations, statuses] = await Promise.all([
    db.offerAutomation.findMany({ where: { publicationMode: 'review' }, select: { id: true, userId: true, enabled: true, lastDiscoveryAt: true, lastSentAt: true, reviewTargetSize: true }, orderBy: { createdAt: 'asc' } }),
    db.offerAutomationReviewItem.groupBy({ by: ['automationId', 'status'], _count: { _all: true }, _min: { createdAt: true } }),
  ])
  const byAutomation = new Map()
  for (const row of statuses) {
    if (!byAutomation.has(row.automationId)) byAutomation.set(row.automationId, {})
    byAutomation.get(row.automationId)[row.status] = { count: row._count._all, oldestAt: row._min.createdAt?.toISOString() || null }
  }
  console.log(JSON.stringify({
    readOnly: true,
    featureEnabled: reviewFeatureEnabled(),
    deliveryEnabled: reviewDeliveryEnabled(),
    automationCount: automations.length,
    automations: automations.map((automation, index) => ({
      ordinal: index + 1,
      enabled: automation.enabled,
      targetSize: automation.reviewTargetSize,
      lastDiscoveryAt: automation.lastDiscoveryAt?.toISOString() || null,
      lastSentAt: automation.lastSentAt?.toISOString() || null,
      statuses: byAutomation.get(automation.id) || {},
    })),
  }, null, 2))
} finally {
  await db.$disconnect()
}
