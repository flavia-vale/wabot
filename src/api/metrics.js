import { getOperationalSignalsSnapshot } from '../observability/operationalSignals.js'

const startedAt = new Date()
const MAX_RECENT_ERRORS = 50
const MAX_ROUTE_METRICS = Math.max(50, Number(process.env.MAX_ROUTE_METRICS || 1000))
const routeMetrics = new Map()
const recentErrors = []

function getRouteKey(req) {
  return req.routeOptions?.url || req.routerPath || req.url?.split('?')[0] || 'unknown'
}

function ensureRouteMetric(method, route) {
  const key = `${method} ${route}`
  if (routeMetrics.size >= MAX_ROUTE_METRICS && !routeMetrics.has(key)) {
    const oldestKey = routeMetrics.keys().next().value
    if (oldestKey) routeMetrics.delete(oldestKey)
  }
  if (!routeMetrics.has(key)) {
    routeMetrics.set(key, {
      method,
      route,
      count: 0,
      errorCount: 0,
      status5xxCount: 0,
      status4xxCount: 0,
      totalMs: 0,
      maxMs: 0,
      lastStatusCode: null,
      lastSeenAt: null,
    })
  }
  return routeMetrics.get(key)
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

export function registerApiMetricsHooks(app) {
  app.addHook('onRequest', async (req) => {
    req.metricsStartedAt = process.hrtime.bigint()
  })

  app.addHook('onResponse', async (req, reply) => {
    const started = req.metricsStartedAt
    if (!started) return
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000
    const route = getRouteKey(req)
    const metric = ensureRouteMetric(req.method, route)
    metric.count++
    metric.totalMs += durationMs
    metric.maxMs = Math.max(metric.maxMs, durationMs)
    metric.lastStatusCode = reply.statusCode
    metric.lastSeenAt = new Date().toISOString()

    if (reply.statusCode >= 500) metric.status5xxCount++
    else if (reply.statusCode >= 400) metric.status4xxCount++

    if (reply.statusCode >= 500) {
      recentErrors.unshift({
        method: req.method,
        route,
        url: req.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(durationMs),
        at: new Date().toISOString(),
      })
      recentErrors.splice(MAX_RECENT_ERRORS)
    }
  })

  app.addHook('onError', async (req, _reply, err) => {
    const route = getRouteKey(req)
    const metric = ensureRouteMetric(req.method, route)
    metric.errorCount++
    recentErrors.unshift({
      method: req.method,
      route,
      url: req.url,
      statusCode: 500,
      error: err.message,
      at: new Date().toISOString(),
    })
    recentErrors.splice(MAX_RECENT_ERRORS)
  })
}

export function getApiMetricsSnapshot() {
  const routes = [...routeMetrics.values()].map(metric => ({
    ...metric,
    avgMs: metric.count ? Math.round(metric.totalMs / metric.count) : 0,
    maxMs: Math.round(metric.maxMs),
    totalMs: Math.round(metric.totalMs),
  }))
  const avgValues = routes.map(route => route.avgMs)
  const totalRequests = routes.reduce((sum, route) => sum + route.count, 0)
  const total5xx = routes.reduce((sum, route) => sum + route.status5xxCount, 0)
  const total4xx = routes.reduce((sum, route) => sum + route.status4xxCount, 0)

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    totalRequests,
    total4xx,
    total5xx,
    errorRate: totalRequests ? Math.round(((total4xx + total5xx) / totalRequests) * 10000) / 100 : 0,
    avgLatencyMs: routes.length ? Math.round(routes.reduce((sum, route) => sum + route.avgMs, 0) / routes.length) : 0,
    p95RouteAvgMs: percentile(avgValues, 95),
    routes: routes.sort((a, b) => b.count - a.count).slice(0, 30),
    recentErrors: recentErrors.slice(0, 20),
    operationalSignals: getOperationalSignalsSnapshot(),
  }
}


function escLabel(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

// Usado pelo gate do /metrics: sem METRICS_TOKEN configurado, só
// loopback/rede privada pode ler o endpoint (que fica fora do rate limit).
export function isPrivateAddress(ip = '') {
  const addr = String(ip).replace(/^::ffff:/, '')
  return addr === '127.0.0.1' || addr === '::1'
    || /^10\./.test(addr) || /^192\.168\./.test(addr)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(addr)
}

export function renderPrometheusMetrics(extra = {}) {
  const routes = [...routeMetrics.values()]
  const totalRequests = routes.reduce((sum, route) => sum + route.count, 0)
  const total4xx = routes.reduce((sum, route) => sum + route.status4xxCount, 0)
  const total5xx = routes.reduce((sum, route) => sum + route.status5xxCount, 0)
  const lines = [
    '# HELP wabot_api_uptime_seconds API uptime in seconds',
    '# TYPE wabot_api_uptime_seconds gauge',
    `wabot_api_uptime_seconds ${Math.round(process.uptime())}`,
    '# HELP wabot_api_requests_total Total API requests observed by route',
    '# TYPE wabot_api_requests_total counter',
  ]

  for (const metric of routes) {
    lines.push(`wabot_api_requests_total{method="${escLabel(metric.method)}",route="${escLabel(metric.route)}"} ${metric.count}`)
  }

  const sessionOwnerMismatchTotal = Number(extra.sessionOwnerMismatchTotal ?? 0)
  const sessionCircuitBreakerAlertTotal = Number(extra.sessionCircuitBreakerAlertTotal ?? 0)
  const sessionQuarantineTotal = Number(extra.sessionQuarantineTotal ?? 0)

  lines.push(
    '# HELP wabot_api_http_4xx_total Total 4xx responses',
    '# TYPE wabot_api_http_4xx_total counter',
    `wabot_api_http_4xx_total ${total4xx}`,
    '# HELP wabot_api_http_5xx_total Total 5xx responses',
    '# TYPE wabot_api_http_5xx_total counter',
    `wabot_api_http_5xx_total ${total5xx}`,
    '# HELP wabot_api_errors_total Total Fastify onError hook events',
    '# TYPE wabot_api_errors_total counter',
    `wabot_api_errors_total ${recentErrors.length}`,
    '# HELP wabot_api_requests_aggregate_total Aggregate request count',
    '# TYPE wabot_api_requests_aggregate_total counter',
    `wabot_api_requests_aggregate_total ${totalRequests}`,
    '# HELP wabot_supervisor_session_owner_mismatch_total Total session-owner mismatches across supervisor shards',
    '# TYPE wabot_supervisor_session_owner_mismatch_total gauge',
    `wabot_supervisor_session_owner_mismatch_total ${Number.isFinite(sessionOwnerMismatchTotal) ? sessionOwnerMismatchTotal : 0}`,
    '# HELP wabot_supervisor_session_circuit_breaker_alert_total Total session circuit-breaker alerts across supervisor shards',
    '# TYPE wabot_supervisor_session_circuit_breaker_alert_total gauge',
    `wabot_supervisor_session_circuit_breaker_alert_total ${Number.isFinite(sessionCircuitBreakerAlertTotal) ? sessionCircuitBreakerAlertTotal : 0}`,
    '# HELP wabot_supervisor_session_quarantine_total Total sessions quarantined by restart budget across supervisor shards',
    '# TYPE wabot_supervisor_session_quarantine_total gauge',
    `wabot_supervisor_session_quarantine_total ${Number.isFinite(sessionQuarantineTotal) ? sessionQuarantineTotal : 0}`,
  )

  // Total restante na DLQ de envio (last-known, atualizado pela poda periódica
  // em src/jobs/dlqMaintenance.js). 0 quando o backend não é BullMQ.
  const dlqTotal = Number(extra.dlqTotal ?? 0)
  lines.push(
    '# HELP wabot_send_dlq_total Last-known number of jobs sitting in the send DLQ',
    '# TYPE wabot_send_dlq_total gauge',
    `wabot_send_dlq_total ${Number.isFinite(dlqTotal) ? dlqTotal : 0}`,
  )

  // Liveness do bot-supervisor (só em modo remote; null/N-A em inline). 1 vivo,
  // 0 morto. Em inline o gauge é omitido — não há supervisor para medir.
  if (extra.supervisorMode === 'remote' && extra.supervisorAlive !== null && extra.supervisorAlive !== undefined) {
    lines.push(
      '# HELP wabot_supervisor_alive Whether the bot-supervisor heartbeat is present (remote mode only)',
      '# TYPE wabot_supervisor_alive gauge',
      `wabot_supervisor_alive ${extra.supervisorAlive ? 1 : 0}`,
    )
  }

  // Sinais operacionais dos gatilhos de escala (auditoria/WABOT-010). Contadores
  // in-process: SQLITE_BUSY é por-processo da API; dedup fail-open vem do worker
  // e some aqui — para histórico cross-processo, ver os AnalyticsEvent
  // `ops_sqlite_busy` / `ops_dedup_fail_open`.
  const opsSignals = Object.entries(getOperationalSignalsSnapshot())
  if (opsSignals.length) {
    lines.push(
      '# HELP wabot_ops_signal_total Total operational-signal occurrences since boot',
      '# TYPE wabot_ops_signal_total counter',
    )
    for (const [name, stats] of opsSignals) {
      lines.push(`wabot_ops_signal_total{signal="${escLabel(name)}"} ${Number(stats.total) || 0}`)
    }
    lines.push(
      '# HELP wabot_ops_signal_24h Operational-signal occurrences in the last 24h',
      '# TYPE wabot_ops_signal_24h gauge',
    )
    for (const [name, stats] of opsSignals) {
      lines.push(`wabot_ops_signal_24h{signal="${escLabel(name)}"} ${Number(stats.last24h) || 0}`)
    }
  }

  return `${lines.join('\n')}\n`
}
