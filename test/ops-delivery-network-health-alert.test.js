import test from 'node:test'
import assert from 'node:assert/strict'
import { createHealthRecorder, decideHealthAlert } from '../src/core/delivery/networkHealth.js'
import { createHealthWatch } from '../src/delivery/telegram/healthWatch.js'
import { getOperationalSignalsSnapshot, __resetOperationalSignals } from '../src/observability/operationalSignals.js'
import { getTemplateDefinition } from '../src/email/registry.js'

// Feature 017, Fatia 6 (T082, FR-042): o aviso interno sai na TRANSIÇÃO para
// um estado ruim, não repete no mesmo estado, e nada é feito em conta do
// WhatsApp. Robô fora do ar não descarta oferta em silêncio (coberto em
// test/delivery-outbox-sweep.test.js: as linhas continuam pendentes).

test('só a transição para estado ruim avisa', () => {
  assert.equal(decideHealthAlert(null, { estado: 'funcionando' }), null)
  assert.equal(decideHealthAlert(null, { estado: 'sem_medicao' }), null)
  assert.deepEqual(decideHealthAlert({ estado: 'funcionando' }, { estado: 'indisponivel' }), { sinal: 'delivery_network_down', estado: 'indisponivel' })
  assert.deepEqual(decideHealthAlert({ estado: 'funcionando' }, { estado: 'limitado' }), { sinal: 'delivery_network_throttled', estado: 'limitado' })
  assert.deepEqual(decideHealthAlert({ estado: 'limitado' }, { estado: 'bloqueado' }), { sinal: 'delivery_network_down', estado: 'bloqueado' })
  assert.equal(decideHealthAlert({ estado: 'indisponivel' }, { estado: 'indisponivel' }), null)
})

test('vigia: e-mail interno + sinal durável na transição, uma vez por estado', async () => {
  __resetOperationalSignals()
  const health = createHealthRecorder()
  const alerts = []
  let t = 1_000_000
  const watch = createHealthWatch({ health, db: {}, sendAdminAlert: async (a) => { alerts.push(a); return { sent: true } }, now: () => t })
  health.record('telegram', 'ok', t - 1000)
  await watch.check()
  for (let i = 3; i > 0; i--) health.record('telegram', 'indisponivel', t - i * 100)
  await watch.check()
  await watch.check()
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].slug, 'admin_robo_aplicativo_parado')
  assert.equal(alerts[0].key, 'telegram:indisponivel')
  assert.equal(alerts[0].vars.aplicativo, 'Telegram')
  assert.equal(alerts[0].vars.estado, 'fora do ar')
  const snapshot = getOperationalSignalsSnapshot()
  const down = JSON.stringify(snapshot)
  assert.match(down, /delivery_network_down/)
  t += 1
})

test('o modelo de e-mail é interno (nunca vai para cliente)', () => {
  const t = getTemplateDefinition('admin_robo_aplicativo_parado')
  assert.equal(t.audience, 'admin')
  assert.equal(t.group, 'interno')
  assert.match(t.body, /WhatsApp de todas as contas continua/)
})
