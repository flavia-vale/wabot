import test from 'node:test'
import assert from 'node:assert/strict'

import {
  OPS_ALERT_SLUG, buildOpsAlerts, findPayingBlind, findPayingDown, isOpsAlertEnabled, STUCK_SENDING_MIN,
} from '../src/ops/adminOpsAlertPolicy.js'
import { runAdminOpsAlertSweep } from '../src/ops/adminOpsAlertSweep.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const NOW = Date.parse('2026-10-02T12:00:00Z')
const h = n => new Date(NOW - n * 3_600_000).toISOString()
const user = (id, waSession) => ({ id, name: id, email: `${id}@x.com`, waSession })

test('pagante parado há mais de 2 h entra; menos de 2 h, conectado e desligado de propósito ficam fora', () => {
  const lista = findPayingDown([
    user('caido', { status: 'disconnected', lastHeartbeatAt: h(3), updatedAt: h(3) }),
    user('recente', { status: 'disconnected', lastHeartbeatAt: h(1), updatedAt: h(1) }),
    user('ok', { status: 'connected', lastHeartbeatAt: h(0) }),
    user('desligou', { status: 'disconnected', lifecycle: 'stopped_by_user', lastHeartbeatAt: h(5), updatedAt: h(5) }),
  ], NOW)
  assert.deepEqual(lista.map(x => x.user.id), ['caido'])
})

test('cega só conta pagante com silêncio >= 3 h', () => {
  const rows = [
    { userId: 'a', metadata: JSON.stringify({ silentForMs: 4 * 3_600_000 }) },
    { userId: 'b', metadata: JSON.stringify({ silentForMs: 1 * 3_600_000 }) },
    { userId: 'nao-pagante', metadata: JSON.stringify({ silentForMs: 9 * 3_600_000 }) },
  ]
  const pagantes = new Map([['a', { name: 'A', email: 'a@x.com' }], ['b', { name: 'B', email: 'b@x.com' }]])
  assert.deepEqual(findPayingBlind(rows, pagantes).map(x => x.user.id), ['a'])
})

test('envios presos só avisam a partir do mínimo', () => {
  assert.equal(buildOpsAlerts({ stuckSending: STUCK_SENDING_MIN - 1 }).length, 0)
  assert.equal(buildOpsAlerts({ stuckSending: STUCK_SENDING_MIN })[0].key, 'envios_presos')
})

test('cada situação tem sua chave de silêncio e a lista é limitada a 10', () => {
  const muitos = Array.from({ length: 14 }, (_, i) => ({ user: { id: `u${i}`, email: `u${i}@x.com` }, downMs: 3 * 3_600_000, owner: 'ninguem' }))
  const alerts = buildOpsAlerts({ payingDown: muitos, stuckSending: 5 })
  assert.deepEqual(alerts.map(a => a.key), ['pagante_caido', 'envios_presos'])
  assert.match(alerts[0].vars.lista, /e mais 4/)
})

test('o modelo existe, é interno e traz as variáveis usadas', () => {
  const def = getTemplateDefinition(OPS_ALERT_SLUG)
  assert.equal(def.audience, 'admin')
  assert.deepEqual(def.variables.map(v => v.name).sort(), ['acao', 'link_cobrancas', 'lista', 'resumo'])
})

test('passada: manda um aviso por situação e respeita o interruptor', async () => {
  const enviados = []
  const db = {
    user: { findMany: async ({ where }) => where.email ? [] : [user('caido', { status: 'disconnected', lastHeartbeatAt: h(4), updatedAt: h(4) })] },
    analyticsEvent: { findMany: async () => [] },
    messageLog: { count: async () => 7 },
  }
  const sendAlert = async args => { enviados.push(args); return { sent: true } }
  const r = await runAdminOpsAlertSweep({ db, sendAlert, env: {}, now: new Date(NOW), logger: { warn() {} } })
  assert.equal(r.sent, 2)
  assert.deepEqual(enviados.map(e => e.key), ['pagante_caido', 'envios_presos'])
  assert.ok(enviados.every(e => e.cooldownHours === 12))

  const off = await runAdminOpsAlertSweep({ db, sendAlert, env: { ADMIN_OPS_ALERT_ENABLED: 'false' }, now: new Date(NOW) })
  assert.equal(off.reason, 'desligado')
  assert.equal(isOpsAlertEnabled({ ADMIN_OPS_ALERT_ENABLED: 'false' }), false)
})
