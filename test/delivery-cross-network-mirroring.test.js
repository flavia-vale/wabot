import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildEntitledGroupConfig } from '../src/billing/groupEntitlements.js'
import { resolveMonitorDestinations } from '../src/core/destinationRouting.js'

// Feature 017, Fatia 4 (T066, US3): uma origem do WhatsApp ligada a um
// destino do WhatsApp E a um do Telegram. A config do robô passa a conter os
// dois; o ramo de hand-off do worker (Fatia 1) manda o do Telegram para a
// caixa de saída depois da conversão/modelo/filtros, aplicados uma vez só.

const FUTURE = new Date(Date.now() + 30 * 86400_000)
const ON = { DELIVERY_NETWORKS_ENABLED: 'whatsapp,telegram' }
const groups = [
  { id: 'm1', role: 'monitor', waJid: 'origem@g.us', kind: 'group', targetsMode: 'explicit' },
  { id: 'p-wa', role: 'post', waJid: '120363@g.us', kind: 'group' },
  { id: 'p-tg', role: 'post', waJid: 'tg:-100120363', kind: 'group', deliveryNetwork: 'telegram' },
  // Mesmo número nos dois aplicativos: identificadores diferentes, sem conflito.
  { id: 'p-tg2', role: 'post', waJid: 'tg:120363', kind: 'group', deliveryNetwork: 'telegram' },
]
const targets = [
  { monitorId: 'm1', post: { waJid: '120363@g.us' } },
  { monitorId: 'm1', post: { waJid: 'tg:-100120363' } },
  { monitorId: 'm1', post: { waJid: 'tg:120363' } },
]

test('Premium com Telegram ligado: a origem chega nos destinos dos dois aplicativos', () => {
  const { groups: cfg } = buildEntitledGroupConfig({ groups, groupTargets: targets, planSubject: { plan: 'premium', accessExpiresAt: FUTURE }, env: ON })
  const monitor = cfg.monitor[0]
  const { destinations } = resolveMonitorDestinations({ targetsMode: monitor.targetsMode, targetPostJids: monitor.targetPostJids, allPostJids: cfg.post })
  assert.deepEqual(destinations, ['120363@g.us', 'tg:-100120363', 'tg:120363'])
  const byJid = Object.fromEntries(cfg.postDetails.map((p) => [p.waJid, p.deliveryNetwork]))
  assert.equal(byJid['120363@g.us'], 'whatsapp')
  assert.equal(byJid['tg:-100120363'], 'telegram')
  assert.equal(byJid['tg:120363'], 'telegram')
})

test('lista explícita vazia continua "nenhum destino", em qualquer aplicativo', () => {
  const { groups: cfg } = buildEntitledGroupConfig({ groups, groupTargets: [], planSubject: { plan: 'premium', accessExpiresAt: FUTURE }, env: ON })
  const monitor = cfg.monitor[0]
  assert.deepEqual(resolveMonitorDestinations({ targetsMode: monitor.targetsMode, targetPostJids: monitor.targetPostJids, allPostJids: cfg.post }).destinations, [])
})

test('sem Premium ou com o Telegram desligado: só os destinos do WhatsApp', () => {
  for (const [planSubject, env] of [[{ plan: 'pro', accessExpiresAt: FUTURE }, ON], [{ plan: 'premium', accessExpiresAt: FUTURE }, {}]]) {
    const { groups: cfg } = buildEntitledGroupConfig({ groups, groupTargets: targets, planSubject, env })
    assert.deepEqual(cfg.monitor[0].targetPostJids, ['120363@g.us'])
  }
})

test('o hand-off do worker acontece depois da conversão e leva a janela anti-repetição do destino', () => {
  const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  const branch = worker.slice(worker.indexOf('const destDeliveryNetwork = postDetail?.deliveryNetwork'), worker.indexOf("'Falha ao enfileirar hand-off multicanal'"))
  assert.match(branch, /texto: finalText/)
  assert.match(branch, /linkConvertido: primary\.converted/)
  assert.match(branch, /janelaRepeticaoMs: effectiveDedupWindowMs/)
  assert.match(branch, /historico: \{ loja: primary\.platform/)
  assert.ok(worker.indexOf('const effectiveDedupWindowMs') < worker.indexOf('const destDeliveryNetwork = postDetail?.deliveryNetwork'))
})
