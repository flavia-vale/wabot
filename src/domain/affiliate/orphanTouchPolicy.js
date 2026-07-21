// 009-affiliate-improvements-r1 (US4): endurece a atribuição órfã por
// dispositivo (matching de touches anônimos por ipHash/uaHash, sem
// visitorId). Módulo puro — sem acesso a DB/env — conforme
// contracts/affiliate-settings.md (semântica de `orphanTouchMode`).
//
// Semântica por modo (contracts/affiliate-settings.md + tasks.md T029):
// - 'off'    : comportamento legado — janela fixa de 30 dias, nunca held.
// - 'window' : usa a janela configurável (orphanTouchWindowDays), sem hold.
// - 'hold'   : usa a janela configurável, comissão resultante nasce held.
// - 'both'   : janela configurável + hold (default seguro).
const LEGACY_WINDOW_DAYS = 30

export function resolveOrphanTouchDecision({ orphanTouchWindowDays = 7, orphanTouchMode = 'both', touchAgeDays = 0 } = {}) {
  const configuredWindowDays = Math.max(1, Number(orphanTouchWindowDays) || 7)
  const effectiveWindowDays = orphanTouchMode === 'off' ? LEGACY_WINDOW_DAYS : configuredWindowDays
  const withinWindow = Number(touchAgeDays) <= effectiveWindowDays
  const holdEnabledForMode = orphanTouchMode === 'hold' || orphanTouchMode === 'both'
  const shouldHold = withinWindow && holdEnabledForMode

  return { withinWindow, shouldHold, effectiveWindowDays }
}
