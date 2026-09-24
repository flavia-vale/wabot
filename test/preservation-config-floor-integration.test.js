import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDestinationPreservation, HARD_DEFAULT_PRESERVATION } from '../src/core/preservationConfig.js'

// T010 — resolveDestinationPreservation de PONTA A PONTA com o piso aplicado
// (contracts/anti-ban-floor.md). Cobre os três pontos da precedência: override
// do grupo, preset atribuído e o modelo padrão da conta (defaultPreset).

test('integração: Group com burstCap menos conservador (20) — efetivo vira 6', () => {
  const group = { burstCap: 20 }
  const r = resolveDestinationPreservation(group, {})
  assert.equal(r.burstCap, 6)
})

test('integração: Group com burstWindowSec mais conservador (1200) — efetivo continua 1200', () => {
  const group = { burstWindowSec: 1200 }
  const r = resolveDestinationPreservation(group, {})
  assert.equal(r.burstWindowSec, 1200)
})

test('integração: destino SEM valor próprio (herdando do modelo padrão da conta) — piso se aplica ao valor HERDADO', () => {
  const defaultPreset = {
    operatingHoursEnabled: false,
    operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
    throttleEnabled: true,
    minIntervalSec: 60,
    burstCap: 15, // menos conservador que o fixo — herdado por um destino sem override
    burstWindowSec: 200, // menos conservador que o fixo — herdado
    dailyCap: 50,
    queueMaxAgeMin: 300,
  }
  // destino sem NENHUM campo próprio: tudo herda do defaultPreset da conta.
  const r = resolveDestinationPreservation({}, { defaultPreset })
  assert.equal(r.burstCap, 6, 'piso aplicado ao valor herdado, não ao "cru" antes da herança')
  assert.equal(r.burstWindowSec, 600, 'piso aplicado ao valor herdado, não ao "cru" antes da herança')
  assert.equal(r.minIntervalSec, 60, 'campo fora do piso continua herdado sem alteração')
})

test('integração: preset atribuído com limites desligados — destino recomeça do padrão do sistema (nunca do preset)', () => {
  const preset = {
    operatingHoursEnabled: false,
    operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
    throttleEnabled: false,
    minIntervalSec: 500,
    burstCap: 1,
    burstWindowSec: 7200,
    dailyCap: 2,
    queueMaxAgeMin: 300,
  }
  const r = resolveDestinationPreservation({}, { preset })
  assert.equal(r.throttleEnabled, true)
  assert.equal(r.minIntervalSec, HARD_DEFAULT_PRESERVATION.minIntervalSec)
  assert.equal(r.dailyCap, HARD_DEFAULT_PRESERVATION.dailyCap)
  assert.equal(r.burstCap, 6)
  assert.equal(r.burstWindowSec, 600)
})

test('integração: ANTI_BAN_FLOOR=off desliga o piso e devolve o valor herdado cru', () => {
  const group = { burstCap: 20, burstWindowSec: 30 }
  const r = resolveDestinationPreservation(group, { env: { ANTI_BAN_FLOOR: 'off' } })
  assert.equal(r.burstCap, 20)
  assert.equal(r.burstWindowSec, 30)
})
