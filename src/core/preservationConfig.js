// Plano B — config de preservação direcionada (por DESTINO).
// Módulo leaf e PURO (sem db/io): resolve a config efetiva de um destino-post a
// partir do override por grupo + preset atribuído + preset default da conta, e
// converte a semântica antiga (janela silenciosa = bloqueio) para a nova
// (horário de funcionamento = quando ENVIA). Ver
// docs/superpowers/plans/2026-06-22-plano-b-config-direcionada-design.md

// Fallback final quando não há preset atribuído nem default (estado teórico —
// a migração semeia um preset default por usuário). Espelha os defaults do
// schema de PreservationPreset.
export const HARD_DEFAULT_PRESERVATION = Object.freeze({
  operatingHoursEnabled: false,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 30,
  burstCap: 6,
  burstWindowSec: 600,
  dailyCap: null,
})

const FIELDS = Object.freeze([
  'operatingHoursEnabled',
  'operatingHoursJson',
  'throttleEnabled',
  'minIntervalSec',
  'burstCap',
  'burstWindowSec',
  'dailyCap',
])

/**
 * Resolve a config efetiva de preservação de um destino.
 * Precedência por campo: override do grupo (não-nulo) → preset atribuído →
 * preset default da conta → HARD_DEFAULT_PRESERVATION. Nunca devolve "sem
 * proteção": ausência total cai no default.
 *
 * @param {object|null} group  campos de override (nuláveis) do Group
 * @param {{ preset?: object|null, defaultPreset?: object|null }} [opts]
 *        preset = preset atribuído ao grupo; defaultPreset = preset isDefault da conta
 * @returns {{operatingHoursEnabled:boolean, operatingHoursJson:string,
 *   throttleEnabled:boolean, minIntervalSec:number, burstCap:number,
 *   burstWindowSec:number, dailyCap:number|null}}
 */
export function resolveDestinationPreservation(group, opts = {}) {
  const base = opts.preset ?? opts.defaultPreset ?? HARD_DEFAULT_PRESERVATION
  const out = {}
  for (const field of FIELDS) {
    const override = group?.[field]
    if (override !== null && override !== undefined) {
      out[field] = override
    } else if (base?.[field] !== null && base?.[field] !== undefined) {
      out[field] = base[field]
    } else {
      out[field] = HARD_DEFAULT_PRESERVATION[field]
    }
  }
  return out
}

function parseHours(raw, fallback) {
  if (raw && typeof raw === 'object') return raw
  try {
    const v = JSON.parse(raw)
    if (Number.isFinite(v?.startHour) && Number.isFinite(v?.endHour)) return v
  } catch { /* ignore */ }
  return fallback
}

/**
 * Converte janela silenciosa (BLOQUEIO) → horário de funcionamento (ENVIO).
 * Funcionamento = complemento da janela silenciosa:
 *   operating = { start: quiet.endHour, end: quiet.startHour, tz }
 * Ex.: quiet {0,6} (silêncio 0h–6h) → funcionamento {6,0} (envia 6h–0h).
 * Caso degenerado quiet {0,0} (nunca silencia) → {0,0} (24h, controlado pelo
 * toggle operatingHoursEnabled). Idempotente em relação ao tz.
 *
 * @param {string|object} quietJson  JSON {startHour,endHour,tz} (formato legado)
 * @returns {string} JSON {startHour,endHour,tz} de funcionamento
 */
export function quietToOperatingHours(quietJson) {
  const quiet = parseHours(quietJson, { startHour: 0, endHour: 6, tz: 'America/Sao_Paulo' })
  return JSON.stringify({
    startHour: quiet.endHour,
    endHour: quiet.startHour,
    tz: typeof quiet.tz === 'string' ? quiet.tz : 'America/Sao_Paulo',
  })
}
