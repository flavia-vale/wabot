// "Sem receber" por cliente na aba Online (E14 do diagnóstico de travamento de
// filas): o sinal `ops_wa_reception_blind` já ia para AnalyticsEvent e virava
// só um número no card da frota — ninguém via QUEM estava cega antes de a
// cliente reclamar. Mesma fonte e mesma janela do card (buildFleetScenarios),
// para lista e card contarem a mesma coisa. Puro; zero IPC com os robôs.

// rows: [{ userId, metadata }] de ops_wa_reception_blind dentro da janela.
// → Map userId -> { haMuito, silentForMs } (pior silêncio visto na janela).
export function summarizeReceptionBlindRows(rows) {
  const byUser = new Map()
  for (const row of rows || []) {
    if (!row?.userId) continue
    let meta = null
    try { meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata } catch { meta = null }
    const prev = byUser.get(row.userId) || { haMuito: false, silentForMs: null }
    const silencio = Number(meta?.silentForMs)
    byUser.set(row.userId, {
      haMuito: prev.haMuito || Boolean(meta?.acrossReconnects),
      silentForMs: Number.isFinite(silencio) && silencio > (prev.silentForMs ?? 0) ? silencio : prev.silentForMs,
    })
  }
  return byUser
}

// Só faz sentido para quem está CONECTADA: desconectada já aparece pelo status
// e pelo motivo da queda; "sem receber" ali seria ruído.
export function resolveReceptionBlindForRow(detailByUser, userId, sessionStatus) {
  if (sessionStatus !== 'connected') return null
  const d = detailByUser instanceof Map ? detailByUser.get(userId) : null
  return d ? { haMuito: d.haMuito, silentForMs: d.silentForMs } : null
}
