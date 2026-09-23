// Piso anti-banimento — ponto ÚNICO da regra dos TRÊS campos fixos por
// destino/modelo (spec FR-010/FR-011/FR-013, contracts/anti-ban-floor.md):
// tamanho da rajada (burstCap), janela da rajada (burstWindowSec) e o
// liga/desliga dos limites do destino (throttleEnabled). Nenhum campo de
// CONTA passa por aqui — o intervalo entre destinos tem módulo próprio
// (destinationSpacing.js) e a variação de imagem não muda.
//
// Módulo PURO: sem banco, sem rede, sem env lida no topo (env sempre por
// parâmetro) — para continuar testável sem mocks de ambiente.
//
// Consumidores permitidos (guarda estrutural em
// test/anti-ban-floor-chokepoint.test.js):
//   - src/core/preservationConfig.js → resolveDestinationPreservation
//   - src/api/routes/preservation.js → describeDestinationFloor (GET)
//   - scripts/diag-antiban-valores.mjs → medição (import, nunca cópia)

import { HARD_DEFAULT_PRESERVATION } from './preservationConfig.js'

export const ANTI_BAN_FLOOR = Object.freeze({
  burstCap: 6,
  burstWindowSec: 600,
  throttleEnabled: true,
})

/**
 * false somente se env.ANTI_BAN_FLOOR === 'off' (exato, case-sensitive).
 * Qualquer outro valor (ausente, '0', 'false', 'OFF'...) mantém ligado —
 * fail-safe: na dúvida, o piso protege.
 * @param {object} [env] default process.env
 */
export function isAntiBanFloorEnabled(env = process.env) {
  return env?.ANTI_BAN_FLOOR !== 'off'
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Aplica o piso de 3 campos numa config efetiva já resolvida (formato de
 * resolveDestinationPreservation). Não muta a entrada.
 *
 * Regra geral (limites ligados): vale o mais conservador entre o gravado e o
 * fixo, campo a campo — burstCap menor vence, burstWindowSec maior vence.
 *
 * Exceção (Achado C′, decisão da dona do produto 2026-09-23): quando o
 * `throttleEnabled` efetivo é `false` (limites desligados), o destino passa a
 * ligado E RECOMEÇA DO PADRÃO DO SISTEMA — minIntervalSec, dailyCap, burstCap
 * e burstWindowSec viram os valores de `systemDefault`
 * (HARD_DEFAULT_PRESERVATION por padrão), ignorando o que estava gravado.
 * `operatingHours*` e `queueMaxAgeMin` não são governados pelo liga/desliga e
 * ficam intocados nos dois ramos.
 *
 * @param {object} effective config efetiva (já resolvida pela precedência)
 * @param {{ enabled?: boolean, systemDefault?: object }} [opts]
 * @returns {object} cópia com o piso aplicado (ou cópia inalterada se enabled=false)
 */
export function applyDestinationFloor(effective, opts = {}) {
  const { enabled = true, systemDefault = HARD_DEFAULT_PRESERVATION } = opts
  const out = { ...effective }
  if (!enabled) return out

  if (effective?.throttleEnabled === false) {
    out.throttleEnabled = true
    out.minIntervalSec = systemDefault.minIntervalSec
    out.dailyCap = systemDefault.dailyCap
    out.burstCap = ANTI_BAN_FLOOR.burstCap
    out.burstWindowSec = ANTI_BAN_FLOOR.burstWindowSec
    return out
  }

  const burstCap = isFiniteNumber(effective?.burstCap) ? effective.burstCap : ANTI_BAN_FLOOR.burstCap
  const burstWindowSec = isFiniteNumber(effective?.burstWindowSec) ? effective.burstWindowSec : ANTI_BAN_FLOOR.burstWindowSec
  out.burstCap = Math.min(burstCap, ANTI_BAN_FLOOR.burstCap)
  out.burstWindowSec = Math.max(burstWindowSec, ANTI_BAN_FLOOR.burstWindowSec)
  out.throttleEnabled = true
  return out
}

/**
 * Descreve, para exibição (GET /presets, /destinations), se o valor GRAVADO
 * (override ou modelo — nunca "herdando") está mais cuidadoso que o piso, ou
 * se o destino recomeçou do padrão por ter estado com os limites desligados.
 * As duas etiquetas nunca vêm juntas.
 *
 * @param {{burstCap?:number, burstWindowSec?:number}|null|undefined} stored
 *   valores gravados; null/undefined = herdando (nada a etiquetar)
 * @param {{ resolvedThrottleEnabled?: boolean }} [opts]
 * @returns {{ ritmoMaisCuidadoso: boolean, camposNoPiso: string[], recomecouDoPadrao: boolean }}
 */
export function describeDestinationFloor(stored, opts = {}) {
  const recomecouDoPadrao = opts.resolvedThrottleEnabled === false
  if (recomecouDoPadrao) {
    return { ritmoMaisCuidadoso: false, camposNoPiso: [], recomecouDoPadrao: true }
  }
  if (stored === null || stored === undefined) {
    return { ritmoMaisCuidadoso: false, camposNoPiso: [], recomecouDoPadrao: false }
  }
  const camposNoPiso = []
  const storedBurstCap = stored.burstCap
  const storedBurstWindowSec = stored.burstWindowSec
  if (isFiniteNumber(storedBurstCap) && storedBurstCap > ANTI_BAN_FLOOR.burstCap) camposNoPiso.push('burstCap')
  if (isFiniteNumber(storedBurstWindowSec) && storedBurstWindowSec < ANTI_BAN_FLOOR.burstWindowSec) camposNoPiso.push('burstWindowSec')
  const ritmoMaisCuidadoso = (isFiniteNumber(storedBurstCap) && storedBurstCap < ANTI_BAN_FLOOR.burstCap)
    || (isFiniteNumber(storedBurstWindowSec) && storedBurstWindowSec > ANTI_BAN_FLOOR.burstWindowSec)
  return { ritmoMaisCuidadoso, camposNoPiso, recomecouDoPadrao: false }
}
