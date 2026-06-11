import defaultDb from '../db.js'
import { parseEnumEnv, logModeSummary } from '../core/envModes.js'

logModeSummary('event-store', { eventStoreMode: parseEnumEnv('EVENT_STORE_MODE', process.env.EVENT_STORE_MODE || 'oltp', ['oltp', 'dual'], 'oltp') })

// Lido a cada escrita (não cacheado no load) para permitir alternar oltp/dual
// sem reiniciar e manter o modo testável.
function eventStoreMode() {
  return parseEnumEnv('EVENT_STORE_MODE', process.env.EVENT_STORE_MODE || 'oltp', ['oltp', 'dual'], 'oltp')
}

function eventStoreDb() {
  // placeholder for P2.3 split: supports dedicated prisma client injection via global
  return globalThis.__WABOT_EVENTS_DB__ || null
}

async function writeDual({ oltpWrite, eventWrite }) {
  const mode = eventStoreMode()
  const result = await oltpWrite()
  if (mode === 'dual' && typeof eventWrite === 'function') {
    await eventWrite().catch(() => {})
  }
  return result
}

export async function writeAnalyticsEvent(data, { db = defaultDb } = {}) {
  return writeDual({
    oltpWrite: () => db.analyticsEvent.create({ data }),
    eventWrite: () => eventStoreDb()?.analyticsEvent?.create?.({ data }),
  })
}

export async function writeAffiliateClick(data, { db = defaultDb } = {}) {
  return writeDual({
    oltpWrite: () => db.affiliateClick.create({ data }),
    eventWrite: () => eventStoreDb()?.affiliateClick?.create?.({ data }),
  })
}

export async function writeFollowLog(data, { db = defaultDb } = {}) {
  return writeDual({
    oltpWrite: () => db.followLog.create({ data }),
    eventWrite: () => eventStoreDb()?.followLog?.create?.({ data }),
  })
}

export async function writeWebhookEvent(data, { db = defaultDb } = {}) {
  return writeDual({
    oltpWrite: () => db.webhookEvent.create({ data }),
    eventWrite: () => eventStoreDb()?.webhookEvent?.create?.({ data }),
  })
}
