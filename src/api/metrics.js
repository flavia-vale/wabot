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
  }
}
