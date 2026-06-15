#!/usr/bin/env node
// Harness de soak/carga para staging (P3.2/P3.3). Gera tráfego realista contra
// a API e amostra métricas para preencher docs/p3-soak-evidence.md.
//
// NÃO roda em produção. Use o ambiente de staging com sessões reais.
//
// O que faz, por DURATION_MIN minutos:
//   - N "tenants virtuais" (tokens JWT fornecidos) disparam broadcasts em
//     cadência configurável (fan-out real pelos grupos cadastrados de cada um)
//   - leituras periódicas do painel (/api/logs/summary) simulando dashboard
//   - amostragem de /metrics e /health a cada SAMPLE_MS
//   - mede latência (p50/p95/p99), taxa de erro, contadores do supervisor
//   - grava um resumo JSON ao final
//
// Uso:
//   SOAK_BASE_URL=http://178.105.54.0:3006 \
//   SOAK_TOKENS=token1,token2,token3 \
//   SOAK_DURATION_MIN=30 SOAK_BROADCAST_EVERY_MS=20000 \
//   node scripts/soak_test.mjs [saida.json]
//
// SOAK_TOKENS: JWTs de usuários de teste em staging (um por tenant virtual).
//   Gere logando via /api/auth/login com contas de teste.
// SOAK_METRICS_TOKEN: se METRICS_TOKEN estiver setado na API, passe aqui.

const BASE_URL = (process.env.SOAK_BASE_URL || 'http://127.0.0.1:3004').replace(/\/$/, '')
const TOKENS = (process.env.SOAK_TOKENS || '').split(',').map((t) => t.trim()).filter(Boolean)
const DURATION_MIN = Math.max(1, Number(process.env.SOAK_DURATION_MIN || 30))
const BROADCAST_EVERY_MS = Math.max(1000, Number(process.env.SOAK_BROADCAST_EVERY_MS || 20_000))
const SUMMARY_EVERY_MS = Math.max(5000, Number(process.env.SOAK_SUMMARY_EVERY_MS || 30_000))
const SAMPLE_MS = Math.max(5000, Number(process.env.SOAK_SAMPLE_MS || 15_000))
const METRICS_TOKEN = process.env.SOAK_METRICS_TOKEN || ''
const OUT_PATH = process.argv[2] || `soak-result-${new Date().toISOString().replace(/[:.]/g, '-')}.json`

if (!TOKENS.length) {
  console.error('ERRO: SOAK_TOKENS vazio. Forneça ao menos um JWT de usuário de teste em staging.')
  process.exit(1)
}

const latencies = []
let requests = 0
let errors = 0
const httpStatus = {}
const samples = []
const startedAt = Date.now()

function recordResult(ms, ok, status) {
  requests++
  latencies.push(ms)
  httpStatus[status] = (httpStatus[status] || 0) + 1
  if (!ok) errors++
}

async function timedFetch(path, { token, method = 'GET', body } = {}) {
  const t0 = Date.now()
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  let status = 0
  try {
    const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    status = res.statusCode || res.status
    await res.text().catch(() => {})
    const ms = Date.now() - t0
    // 429 (rate limit/quota) é resposta esperada sob carga — não conta como erro
    recordResult(ms, status < 500 || status === 429, status)
    return { status, ms }
  } catch (err) {
    recordResult(Date.now() - t0, false, 'network_error')
    return { status: 0, error: err.message }
  }
}

function percentile(arr, p) {
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function sampleMetrics() {
  const headers = METRICS_TOKEN ? { authorization: `Bearer ${METRICS_TOKEN}` } : {}
  try {
    const res = await fetch(`${BASE_URL}/metrics`, { headers })
    const text = await res.text()
    const grab = (name) => {
      const m = text.match(new RegExp(`^${name}\\s+(\\d+)`, 'm'))
      return m ? Number(m[1]) : null
    }
    samples.push({
      at: new Date().toISOString(),
      elapsedMin: ((Date.now() - startedAt) / 60_000).toFixed(1),
      http5xx: grab('wabot_api_http_5xx_total'),
      http4xx: grab('wabot_api_http_4xx_total'),
      requestsTotal: grab('wabot_api_requests_aggregate_total'),
      ownerMismatch: grab('wabot_supervisor_session_owner_mismatch_total'),
      circuitBreaker: grab('wabot_supervisor_session_circuit_breaker_alert_total'),
      quarantine: grab('wabot_supervisor_session_quarantine_total'),
      metricsStatus: res.statusCode || res.status,
    })
  } catch (err) {
    samples.push({ at: new Date().toISOString(), error: err.message })
  }
}

async function tenantLoop(token, index, deadline) {
  // desfasa o início de cada tenant para não sincronizar picos
  await new Promise((r) => setTimeout(r, (index * BROADCAST_EVERY_MS) / Math.max(1, TOKENS.length)))
  while (Date.now() < deadline) {
    await timedFetch('/api/broadcast/send', {
      token,
      method: 'POST',
      body: { text: `[soak] oferta ${new Date().toISOString()}`, idempotencyKey: `soak-${index}-${Date.now()}` },
    })
    // leitura de painel intercalada (simula dashboard aberto)
    await timedFetch('/api/logs/summary?days=7', { token })
    await new Promise((r) => setTimeout(r, BROADCAST_EVERY_MS))
  }
}

function writeSummary(final = false) {
  const summary = {
    config: { baseUrl: BASE_URL, tenants: TOKENS.length, durationMin: DURATION_MIN, broadcastEveryMs: BROADCAST_EVERY_MS },
    elapsedMin: ((Date.now() - startedAt) / 60_000).toFixed(1),
    requests,
    errors,
    errorRatePct: requests ? ((errors / requests) * 100).toFixed(2) : '0',
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99: percentile(latencies, 99), max: latencies.length ? Math.max(...latencies) : null },
    httpStatus,
    metricsSamples: samples,
    final,
  }
  if (final) {
    import('node:fs').then(({ writeFileSync }) => writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2)))
    console.log(`\n=== SOAK FINALIZADO ===\nresultado: ${OUT_PATH}`)
  }
  console.log(`[${summary.elapsedMin}min] req=${requests} err=${errors} (${summary.errorRatePct}%) p95=${summary.latencyMs.p95}ms p99=${summary.latencyMs.p99}ms`)
  return summary
}

async function main() {
  console.log(`Soak: ${TOKENS.length} tenant(s), ${DURATION_MIN}min, alvo ${BASE_URL}`)
  const deadline = Date.now() + DURATION_MIN * 60_000
  const metricsTimer = setInterval(sampleMetrics, SAMPLE_MS)
  const summaryTimer = setInterval(() => writeSummary(false), SUMMARY_EVERY_MS)
  await sampleMetrics()
  await Promise.all(TOKENS.map((token, i) => tenantLoop(token, i, deadline)))
  clearInterval(metricsTimer)
  clearInterval(summaryTimer)
  await sampleMetrics()
  writeSummary(true)
}

main().catch((err) => { console.error('Soak falhou:', err); process.exit(1) })
