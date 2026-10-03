// Telemetria da tela "Conexão WhatsApp" do painel da CLIENTE (etapa, evento,
// detalhe, segundos). Nasceu dentro de `AdminAuditLog` e virou 75 % daquela
// tabela em produção (medição de 2026-10-02) sem ser auditoria de nada: a
// trilha de "quem fez o quê" ficou soterrada por "cliente abriu o QR".
// Agora mora em `AnalyticsEvent` (evento `session_telemetry`). Este módulo é
// PURO: só monta o relatório a partir das linhas já carregadas.

export const SESSION_TELEMETRY_EVENT = 'session_telemetry'

export function parseTelemetryMetadata(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * @param rows linhas de AnalyticsEvent ({ id, userId, createdAt, metadata })
 * @param usersById Map<userId, { email, name }> carregado em lote (nunca por linha)
 */
export function buildSessionTelemetryReport({ rows = [], usersById = new Map() } = {}) {
  const events = rows.map((row) => {
    const payload = parseTelemetryMetadata(row.metadata)
    const user = row.userId ? usersById.get(row.userId) ?? null : null
    return {
      id: row.id,
      createdAt: row.createdAt,
      userId: row.userId ?? null,
      user,
      stage: payload.stage ?? 'unknown',
      event: payload.event ?? 'unknown',
      detail: payload.detail ?? null,
      elapsedSec: payload.elapsedSec ?? null,
    }
  })
  const summary = events.reduce((acc, item) => {
    const key = `${item.stage || 'unknown'}:${item.event || 'unknown'}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  return { total: events.length, summary, events }
}
