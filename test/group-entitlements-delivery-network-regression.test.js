import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEntitledGroupConfig } from '../src/billing/groupEntitlements.js'

// Feature 017 (arquitetura multicanal de entrega), US1 cenário 2 / FR-013:
// para um grupo/canal SEM `deliveryNetwork` gravado (todo destino/origem de
// hoje), toMonitorGroup/toPostDetail devolvem `deliveryNetwork: 'whatsapp'`
// e o RESTANTE da config é byte a byte o que era antes desta feature — é a
// prova de que quem usa só WhatsApp não percebe nada.

const groups = [
  { id: 'm-group', role: 'monitor', waJid: 'monitor@g.us', kind: 'group', imageLinkTarget: 'first', blockedKeywords: null, allowedPlatforms: null, forwardMode: 'LINK_ONLY', noLinkScope: null },
  { id: 'p-group', role: 'post', waJid: 'post@g.us', kind: 'group', welcomeMsg: 'oi', imageMode: 'original' },
  { id: 'p-channel', role: 'post', waJid: 'post@newsletter', kind: 'channel', welcomeMsg: 'canal', channelButtonJid: null },
]

const groupTargets = [
  { monitorId: 'm-group', post: { waJid: 'post@g.us', kind: 'group' } },
  { monitorId: 'm-group', post: { waJid: 'post@newsletter', kind: 'channel' } },
]

// Snapshot da config ANTES desta feature (o mesmo shape produzido por
// toMonitorGroup/toPostDetail sem o campo deliveryNetwork), para comparação
// byte a byte "resto igual, só ganhou o campo novo".
function stripDeliveryNetwork(entries) {
  return entries.map(({ deliveryNetwork: _omit, ...rest }) => rest)
}

test('grupo sem deliveryNetwork gravado: toMonitorGroup/toPostDetail resolvem para whatsapp', () => {
  const result = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'pro' } })

  for (const monitor of result.groups.monitor) {
    assert.equal(monitor.deliveryNetwork, 'whatsapp')
  }
  for (const post of result.groups.postDetails) {
    assert.equal(post.deliveryNetwork, 'whatsapp')
  }
})

test('o restante da config é byte a byte o mesmo, além do campo deliveryNetwork novo', () => {
  const result = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'pro' } })

  const monitorWithoutNetwork = stripDeliveryNetwork(result.groups.monitor)
  const postDetailsWithoutNetwork = stripDeliveryNetwork(result.groups.postDetails)

  assert.deepEqual(monitorWithoutNetwork, [{
    id: 'm-group',
    waJid: 'monitor@g.us',
    kind: 'group',
    imageLinkTarget: 'first',
    fallbackToOriginal: true,
    blockedKeywords: null,
    allowedPlatforms: null,
    forwardMode: 'LINK_ONLY',
    noLinkScope: null,
    templateKey: null,
    relayFooterText: null,
    primaryLinkTarget: null,
    targetPostJids: ['post@g.us', 'post@newsletter'],
    targetsMode: 'all',
  }])

  assert.deepEqual(postDetailsWithoutNetwork, [
    {
      waJid: 'post@g.us',
      kind: 'group',
      welcomeMsg: 'oi',
      channelButtonJid: null,
      channelButtonName: null,
      imageMode: 'original',
      watermarkText: null,
      watermarkColor: null,
      watermarkSize: null,
      watermarkPosition: null,
    },
    {
      waJid: 'post@newsletter',
      kind: 'channel',
      welcomeMsg: 'canal',
      channelButtonJid: null,
      channelButtonName: null,
      imageMode: 'original',
      watermarkText: null,
      watermarkColor: null,
      watermarkSize: null,
      watermarkPosition: null,
    },
  ])

  assert.deepEqual(result.groups.monitorJids, ['monitor@g.us'])
  assert.deepEqual(result.groups.post, ['post@g.us', 'post@newsletter'])
  assert.equal(result.blockedChannelCount, 0)
})

test('valor legado/desconhecido de deliveryNetwork também resolve para whatsapp (nunca "desconhecido")', () => {
  const custom = [
    { id: 'p1', role: 'post', waJid: 'a@g.us', kind: 'group', deliveryNetwork: 'algo-invalido' },
  ]
  const result = buildEntitledGroupConfig({ groups: custom, groupTargets: [], planSubject: { plan: 'pro' } })
  assert.equal(result.groups.postDetails[0].deliveryNetwork, 'whatsapp')
})
