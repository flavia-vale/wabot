import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEntitledGroupConfig } from '../src/billing/groupEntitlements.js'
import { resolveGroupImageMode } from '../src/core/imageModePolicy.js'

const groups = [
  { id: 'm-group', role: 'monitor', waJid: 'monitor@g.us', kind: 'group', imageLinkTarget: 'first', blockedKeywords: null, allowedPlatforms: null, forwardMode: 'LINK_ONLY', noLinkScope: null },
  { id: 'm-channel', role: 'monitor', waJid: 'monitor@newsletter', kind: 'channel', imageLinkTarget: 'first', blockedKeywords: null, allowedPlatforms: null, forwardMode: 'LINK_ONLY', noLinkScope: null },
  { id: 'p-group', role: 'post', waJid: 'post@g.us', kind: 'group', welcomeMsg: 'oi' },
  { id: 'p-channel', role: 'post', waJid: 'post@newsletter', kind: 'channel', welcomeMsg: 'canal' },
]

const groupTargets = [
  { monitorId: 'm-group', post: { waJid: 'post@g.us', kind: 'group' } },
  { monitorId: 'm-group', post: { waJid: 'post@newsletter', kind: 'channel' } },
  { monitorId: 'm-channel', post: { waJid: 'post@g.us', kind: 'group' } },
]

test('buildEntitledGroupConfig removes all channel monitors, posts and targets for Basic', () => {
  const result = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'basic' } })

  assert.equal(result.blockedChannelCount, 2)
  assert.deepEqual(result.groups.monitor.map(g => g.waJid), ['monitor@g.us'])
  assert.deepEqual(result.groups.monitor[0].targetPostJids, ['post@g.us'])
  assert.deepEqual(result.groups.monitorJids, ['monitor@g.us'])
  assert.deepEqual(result.groups.post, ['post@g.us'])
  assert.deepEqual(result.groups.postDetails, [{ waJid: 'post@g.us', kind: 'group', welcomeMsg: 'oi', channelButtonJid: null, channelButtonName: null }])
})

test('buildEntitledGroupConfig respeita a escolha da cliente e cai no modo global quando não há escolha', () => {
  const custom = [
    { id: 'm-default', role: 'monitor', waJid: 'a@g.us', kind: 'group', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-fetch', role: 'monitor', waJid: 'b@g.us', kind: 'group', imageMode: 'fetch', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-none', role: 'monitor', waJid: 'c@g.us', kind: 'group', imageMode: 'none', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-original', role: 'monitor', waJid: 'e@g.us', kind: 'group', imageMode: 'original', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-null', role: 'monitor', waJid: 'f@g.us', kind: 'group', imageMode: null, imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-legacy', role: 'monitor', waJid: 'g@g.us', kind: 'group', imageMode: 'legado-desconhecido', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-preview', role: 'monitor', waJid: 'd@g.us', kind: 'group', imageMode: 'preview', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
  ]
  const result = buildEntitledGroupConfig({ groups: custom, groupTargets: [], planSubject: { plan: 'pro' } })
  const byJid = Object.fromEntries(result.groups.monitor.map(g => [g.waJid, g]))

  // 2026-08-22 (chokepoint em src/billing/groupEntitlements.js): a escolha por
  // grupo voltou à tela. Quem escolheu um dos DOIS formatos oferecidos recebe o
  // que escolheu.
  assert.equal(byJid['d@g.us'].imageMode, 'preview', 'grupo que escolheu o card clicável recebe preview')
  assert.equal(byJid['e@g.us'].imageMode, 'original', 'grupo que escolheu a foto da oferta recebe original')

  // Quem nunca escolheu — e quem tem valor legado de um modo que a tela NÃO
  // oferece (fetch/none/lixo) — segue o modo global. Isso impede que um dado
  // antigo reative sozinho um caminho dormente (FR-006).
  for (const jid of ['a@g.us', 'b@g.us', 'c@g.us', 'f@g.us', 'g@g.us']) {
    assert.equal(byJid[jid].imageMode, resolveGroupImageMode(), `sem escolha válida, ${jid} deveria seguir o modo global`)
  }

  // fallbackToOriginal segue sempre ligado (rede de segurança preservada, mesmo dormente).
  assert.equal(byJid['b@g.us'].fallbackToOriginal, true)
})

test('buildEntitledGroupConfig keeps channels for active trial and Pro', () => {
  const trial = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'trial', accessExpiresAt: new Date(Date.now() + 86400000) } })
  const pro = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'pro' } })

  assert.deepEqual(trial.groups.monitorJids, ['monitor@g.us', 'monitor@newsletter'])
  assert.deepEqual(pro.groups.post, ['post@g.us', 'post@newsletter'])
  assert.equal(trial.blockedChannelCount, 0)
  assert.equal(pro.blockedChannelCount, 0)
})
