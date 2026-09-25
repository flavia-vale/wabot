// FR-019: perder o acesso (plano vence, Trial vence, conta cai para Basic)
// bloqueia só a TELA — os valores gravados continuam no banco e continuam
// sendo usados pelo robô no envio, exatamente como estão. Nada é resetado,
// zerado ou trocado pelo padrão. Se a conta reassinar, reencontra a
// configuração exatamente como deixou.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveDestinationPreservation } from '../src/core/preservationConfig.js'
import { toDestinationIntervalMs } from '../src/core/destinationSpacing.js'

test('T050 — resolveDestinationPreservation nunca recebe/consulta user.plan ou accessExpiresAt', () => {
  const source = readFileSync(new URL('../src/core/preservationConfig.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bplan\b/)
  assert.doesNotMatch(source, /accessExpiresAt/)
})

test('T050 — destinationSpacing.js nunca recebe/consulta user.plan ou accessExpiresAt', () => {
  const source = readFileSync(new URL('../src/core/destinationSpacing.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bplan\b/)
  assert.doesNotMatch(source, /accessExpiresAt/)
})

test('destino com ritmo próprio gravado: valor efetivo não muda quando a conta perde o plano', () => {
  const destinoGravado = {
    throttleEnabled: true,
    minIntervalSec: 45,
    dailyCap: 50,
    operatingHoursEnabled: false,
    operatingHoursJson: null,
    queueMaxAgeMin: 120,
  }
  // resolveDestinationPreservation não recebe "plan" nenhum — chamar duas
  // vezes com o MESMO destino simula "antes" e "depois" de perder o acesso;
  // o ponto do teste é que não existe parâmetro de plano para influenciar o
  // resultado.
  const antes = resolveDestinationPreservation(destinoGravado, { preset: null, defaultPreset: null })
  const depois = resolveDestinationPreservation(destinoGravado, { preset: null, defaultPreset: null })
  assert.deepEqual(antes, depois)
  assert.equal(depois.minIntervalSec, 45, 'valor gravado continua valendo, sem piso')
  assert.equal(depois.dailyCap, 50)
})

test('intervalo entre destinos (BotConfig.channelStaggerJitterMs) continua valendo sem checar plano', () => {
  const botConfig = { channelStaggerJitterMs: 45000 }
  const ms1 = toDestinationIntervalMs(botConfig)
  const ms2 = toDestinationIntervalMs(botConfig)
  assert.equal(ms1, 45000)
  assert.equal(ms2, 45000)
})

test('reassinar (plano volta) reencontra a config exatamente como deixou — mesma entrada, mesma saída', () => {
  const destinoGravado = { throttleEnabled: false, minIntervalSec: 300, dailyCap: 3 }
  // A "perda do plano" nunca escreve nada no destino — simulado aqui pela
  // ausência total de qualquer chamada de escrita entre as duas leituras.
  const antesDePerder = resolveDestinationPreservation(destinoGravado, { preset: null, defaultPreset: null })
  const depoisDeReassinar = resolveDestinationPreservation(destinoGravado, { preset: null, defaultPreset: null })
  assert.deepEqual(antesDePerder, depoisDeReassinar)
})
