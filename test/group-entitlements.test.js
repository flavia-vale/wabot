import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEntitledGroupConfig } from '../src/billing/groupEntitlements.js'

const groups = [
  { id: 'm-group', role: 'monitor', waJid: 'monitor@g.us', kind: 'group', imageLinkTarget: 'first', blockedKeywords: null, allowedPlatforms: null, forwardMode: 'LINK_ONLY', noLinkScope: null },
  { id: 'm-channel', role: 'monitor', waJid: 'monitor@newsletter', kind: 'channel', imageLinkTarget: 'first', blockedKeywords: null, allowedPlatforms: null, forwardMode: 'LINK_ONLY', noLinkScope: null },
  { id: 'p-group', role: 'post', waJid: 'post@g.us', kind: 'group', welcomeMsg: 'oi', imageMode: 'original_watermark', watermarkText: 'Minha marca' },
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
  assert.deepEqual(result.groups.postDetails, [{ waJid: 'post@g.us', kind: 'group', welcomeMsg: 'oi', channelButtonJid: null, channelButtonName: null, imageMode: 'original_watermark', watermarkText: 'Minha marca' }])
})

test('buildEntitledGroupConfig carrega modo por destino e nao pela origem', () => {
  const result = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'pro' } })
  const source = result.groups.monitor.find(group => group.waJid === 'monitor@g.us')
  const destination = result.groups.postDetails.find(group => group.waJid === 'post@g.us')
  assert.equal('imageMode' in source, false)
  assert.equal(destination.imageMode, 'original_watermark')
  assert.equal(destination.watermarkText, 'Minha marca')
})

test('buildEntitledGroupConfig keeps channels for active trial and Pro', () => {
  const trial = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'trial', accessExpiresAt: new Date(Date.now() + 86400000) } })
  const pro = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'pro' } })

  assert.deepEqual(trial.groups.monitorJids, ['monitor@g.us', 'monitor@newsletter'])
  assert.deepEqual(pro.groups.post, ['post@g.us', 'post@newsletter'])
  assert.equal(trial.blockedChannelCount, 0)
  assert.equal(pro.blockedChannelCount, 0)
})
