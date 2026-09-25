// Plano B — config de preservação direcionada (por DESTINO).
// Módulo leaf e PURO (sem db/io): resolve a config efetiva de um destino-post a
// partir do override por grupo + preset atribuído + preset default da conta, e
// converte a semântica antiga (janela silenciosa = bloqueio) para a nova
// (horário de funcionamento = quando ENVIA). Ver
// docs/superpowers/plans/2026-06-22-plano-b-config-direcionada-design.md
//
// 2026-09-25: o "piso anti-banimento" (specs/018-unificar-protecao-anti-ban) —
// que forçava burstCap/burstWindowSec/throttleEnabled para um valor fixo,
// independente do que a cliente configurasse — foi REMOVIDO por pedido
// explícito da dona do produto. Só os três campos que a tela oferece
// (minIntervalSec, dailyCap, queueMaxAgeMin) continuam existindo, e o valor
// gravado é usado como veio, sem nenhum piso por cima. Não reintroduzir esse
// mecanismo sem pedido novo e explícito.

// Fallback final quando não há preset atribuído nem default (estado teórico —
// a migração semeia um preset default por usuário). Espelha os defaults do
// schema de PreservationPreset.
export const HARD_DEFAULT_PRESERVATION = Object.freeze({
  operatingHoursEnabled: false,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 30,
  dailyCap: null,
  // Descarte por idade na fila (minutos). 0 = nunca descarta. Ver
  // src/core/queueExpiry.js e o RCA da fila entupida no AGENTS.md.
  queueMaxAgeMin: 300,
})

const FIELDS = Object.freeze([
  'operatingHoursEnabled',
  'operatingHoursJson',
  'throttleEnabled',
  'minIntervalSec',
  'dailyCap',
  'queueMaxAgeMin',
])

/**
 * Resolve a config efetiva de preservação de um destino.
 * Precedência por campo: override do grupo (não-nulo) → preset atribuído →
 * preset default da conta → HARD_DEFAULT_PRESERVATION. Nunca devolve "sem
 * proteção": ausência total cai no default. Sem piso por cima — o valor
 * herdado/gravado é o valor que vale (2026-09-25).
 *
 * @param {object|null} group  campos de override (nuláveis) do Group
 * @param {{ preset?: object|null, defaultPreset?: object|null }} [opts]
 *        preset = preset atribuído ao grupo; defaultPreset = preset isDefault da conta
 * @returns {{operatingHoursEnabled:boolean, operatingHoursJson:string,
 *   throttleEnabled:boolean, minIntervalSec:number, dailyCap:number|null,
 *   queueMaxAgeMin:number}}
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
