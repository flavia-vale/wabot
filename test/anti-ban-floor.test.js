import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ANTI_BAN_FLOOR,
  isAntiBanFloorEnabled,
  applyDestinationFloor,
  describeDestinationFloor,
} from '../src/core/antiBanFloor.js'
import { HARD_DEFAULT_PRESERVATION } from '../src/core/preservationConfig.js'

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/anti-ban-floor.md
// Tabela de verdade mínima (§ do contrato) + exceção "limites desligados →
// recomeça do padrão do sistema" (Achado C′, decisão da dona do produto de
// 2026-09-23).

test('ANTI_BAN_FLOOR é o valor fixo esperado e está congelado', () => {
  assert.deepEqual(ANTI_BAN_FLOOR, { burstCap: 6, burstWindowSec: 600, throttleEnabled: true })
  assert.ok(Object.isFrozen(ANTI_BAN_FLOOR))
})

// ---------- isAntiBanFloorEnabled ----------

test('isAntiBanFloorEnabled: ligado por padrão (env ausente)', () => {
  assert.equal(isAntiBanFloorEnabled({}), true)
})

test('isAntiBanFloorEnabled: só "off" exato desliga', () => {
  assert.equal(isAntiBanFloorEnabled({ ANTI_BAN_FLOOR: 'off' }), false)
  assert.equal(isAntiBanFloorEnabled({ ANTI_BAN_FLOOR: '0' }), true)
  assert.equal(isAntiBanFloorEnabled({ ANTI_BAN_FLOOR: 'false' }), true)
  assert.equal(isAntiBanFloorEnabled({ ANTI_BAN_FLOOR: 'OFF' }), true) // case-sensitive: só 'off' minúsculo
  assert.equal(isAntiBanFloorEnabled({ ANTI_BAN_FLOOR: '' }), true)
})

test('isAntiBanFloorEnabled: usa process.env por padrão quando nenhum env é passado', () => {
  assert.equal(isAntiBanFloorEnabled(), true)
})

// ---------- applyDestinationFloor — regra geral (campo a campo) ----------

const baseEffective = () => ({
  operatingHoursEnabled: false,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 30,
  burstCap: 6,
  burstWindowSec: 600,
  dailyCap: null,
  queueMaxAgeMin: 300,
})

test('applyDestinationFloor: throttle on, 6/600 (igual ao fixo) não muda nada', () => {
  const out = applyDestinationFloor(baseEffective())
  assert.deepEqual(out, baseEffective())
})

test('applyDestinationFloor: burstCap menor que 6 é mais conservador — conta mantém o próprio valor', () => {
  const out = applyDestinationFloor({ ...baseEffective(), burstCap: 3 })
  assert.equal(out.burstCap, 3)
})

test('applyDestinationFloor: burstCap maior que 6 é menos conservador — conta passa ao fixo (6)', () => {
  const out = applyDestinationFloor({ ...baseEffective(), burstCap: 10 })
  assert.equal(out.burstCap, 6)
})

test('applyDestinationFloor: burstWindowSec maior que 600 é mais conservador — conta mantém o próprio valor', () => {
  const out = applyDestinationFloor({ ...baseEffective(), burstWindowSec: 3600 })
  assert.equal(out.burstWindowSec, 3600)
})

test('applyDestinationFloor: burstWindowSec menor que 600 é menos conservador — conta passa ao fixo (600)', () => {
  const out = applyDestinationFloor({ ...baseEffective(), burstWindowSec: 120 })
  assert.equal(out.burstWindowSec, 600)
})

test('applyDestinationFloor: preset "Leve" (10/3600) vira 6/3600 (Achado B — cada campo é independente)', () => {
  const out = applyDestinationFloor({ ...baseEffective(), burstCap: 10, burstWindowSec: 3600 })
  assert.equal(out.burstCap, 6)
  assert.equal(out.burstWindowSec, 3600)
})

test('applyDestinationFloor: minIntervalSec/dailyCap ligados não são tocados pela regra geral', () => {
  const out = applyDestinationFloor({ ...baseEffective(), minIntervalSec: 120, dailyCap: 5 })
  assert.equal(out.minIntervalSec, 120)
  assert.equal(out.dailyCap, 5)
})

test('applyDestinationFloor: campo null/não numérico cai no valor do piso (fail-safe)', () => {
  const out = applyDestinationFloor({ ...baseEffective(), burstCap: null, burstWindowSec: 'abc' })
  assert.equal(out.burstCap, 6)
  assert.equal(out.burstWindowSec, 600)
})

test('applyDestinationFloor: não muta a entrada (devolve cópia)', () => {
  const input = { ...baseEffective(), burstCap: 50 }
  const inputSnapshot = { ...input }
  const out = applyDestinationFloor(input)
  assert.deepEqual(input, inputSnapshot, 'entrada não pode ser mutada')
  assert.notEqual(out, input, 'saída precisa ser um objeto novo')
  assert.equal(out.burstCap, 6)
})

test('applyDestinationFloor: enabled=false devolve a entrada inalterada (cópia)', () => {
  const input = { ...baseEffective(), burstCap: 999, burstWindowSec: 1, throttleEnabled: false }
  const out = applyDestinationFloor(input, { enabled: false })
  assert.deepEqual(out, input)
  assert.notEqual(out, input)
})

// ---------- applyDestinationFloor — exceção "limites desligados → recomeça do padrão do sistema" ----------
// (Achado C′, decisão da dona do produto de 2026-09-23: distinta da regra geral)

test('applyDestinationFloor: limites desligados recomeça do padrão do sistema (ignora valores antigos gravados)', () => {
  const stored = {
    ...baseEffective(),
    throttleEnabled: false,
    minIntervalSec: 300,
    dailyCap: 3,
    burstCap: 2,
    burstWindowSec: 3600,
  }
  const out = applyDestinationFloor(stored)
  assert.equal(out.throttleEnabled, true)
  assert.equal(out.minIntervalSec, HARD_DEFAULT_PRESERVATION.minIntervalSec)
  assert.equal(out.minIntervalSec, 30)
  assert.equal(out.dailyCap, HARD_DEFAULT_PRESERVATION.dailyCap)
  assert.equal(out.dailyCap, null)
  assert.equal(out.burstCap, 6)
  assert.equal(out.burstWindowSec, 600)
})

test('applyDestinationFloor: limites desligados preserva horário de funcionamento e queueMaxAgeMin intocados', () => {
  const stored = {
    ...baseEffective(),
    throttleEnabled: false,
    operatingHoursEnabled: true,
    operatingHoursJson: '{"startHour":9,"endHour":18,"tz":"America/Sao_Paulo"}',
    queueMaxAgeMin: 60,
  }
  const out = applyDestinationFloor(stored)
  assert.equal(out.operatingHoursEnabled, true)
  assert.equal(out.operatingHoursJson, stored.operatingHoursJson)
  assert.equal(out.queueMaxAgeMin, 60)
})

test('applyDestinationFloor: aceita systemDefault customizado na exceção de limites desligados', () => {
  const customDefault = { minIntervalSec: 45, dailyCap: 7, burstCap: 6, burstWindowSec: 600 }
  const out = applyDestinationFloor(
    { ...baseEffective(), throttleEnabled: false, minIntervalSec: 999, dailyCap: 999 },
    { systemDefault: customDefault },
  )
  assert.equal(out.minIntervalSec, 45)
  assert.equal(out.dailyCap, 7)
})

// ---------- describeDestinationFloor ----------

test('describeDestinationFloor: destino com valor mais conservador ganha ritmoMaisCuidadoso', () => {
  const d = describeDestinationFloor({ burstCap: 3, burstWindowSec: 600 }, { resolvedThrottleEnabled: true })
  assert.equal(d.ritmoMaisCuidadoso, true)
  assert.equal(d.recomecouDoPadrao, false)
})

test('describeDestinationFloor: destino igual ao fixo não ganha etiqueta', () => {
  const d = describeDestinationFloor({ burstCap: 6, burstWindowSec: 600 }, { resolvedThrottleEnabled: true })
  assert.equal(d.ritmoMaisCuidadoso, false)
  assert.equal(d.recomecouDoPadrao, false)
})

test('describeDestinationFloor: destino menos conservador (burstCap 10) não ganha etiqueta, mas aparece em camposNoPiso', () => {
  const d = describeDestinationFloor({ burstCap: 10, burstWindowSec: 600 }, { resolvedThrottleEnabled: true })
  assert.equal(d.ritmoMaisCuidadoso, false)
  assert.ok(d.camposNoPiso.includes('burstCap'))
})

test('describeDestinationFloor: "Leve" (10/3600) ganha ritmoMaisCuidadoso por causa da janela', () => {
  const d = describeDestinationFloor({ burstCap: 10, burstWindowSec: 3600 }, { resolvedThrottleEnabled: true })
  assert.equal(d.ritmoMaisCuidadoso, true)
  assert.equal(d.recomecouDoPadrao, false)
})

test('describeDestinationFloor: recomecouDoPadrao quando os limites efetivos estavam desligados; nunca junto de ritmoMaisCuidadoso', () => {
  const d = describeDestinationFloor({ burstCap: 2, burstWindowSec: 3600 }, { resolvedThrottleEnabled: false })
  assert.equal(d.recomecouDoPadrao, true)
  assert.equal(d.ritmoMaisCuidadoso, false)
})

test('describeDestinationFloor: stored null/undefined (herdando) não quebra e não etiqueta', () => {
  const d = describeDestinationFloor(null, { resolvedThrottleEnabled: true })
  assert.equal(d.ritmoMaisCuidadoso, false)
  assert.equal(d.recomecouDoPadrao, false)
  assert.deepEqual(d.camposNoPiso, [])
})
