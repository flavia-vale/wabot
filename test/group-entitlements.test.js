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
  // Divisão Basic/PRO (2026-09-23): a marca d'água é do PRO. No Basic o destino
  // sai SEM marca e no mesmo formato ('original_watermark' → 'original'), e o
  // botão "Ver canal" também sai. O texto da marca fica guardado — voltar para o
  // PRO não pede para configurar de novo.
  assert.deepEqual(result.groups.postDetails, [{ waJid: 'post@g.us', kind: 'group', welcomeMsg: 'oi', channelButtonJid: null, channelButtonName: null, imageMode: 'original', watermarkText: 'Minha marca', watermarkColor: null, watermarkSize: null, watermarkPosition: null }])
})

test('Basic: card com marca vira card, e o botão "Ver canal" sai; PRO mantém os dois', () => {
  const posts = [
    { id: 'p1', role: 'post', waJid: 'a@g.us', kind: 'group', imageMode: 'preview_watermark', watermarkText: 'Marca', channelButtonJid: '123@newsletter', channelButtonName: 'Canal' },
    { id: 'p2', role: 'post', waJid: 'b@g.us', kind: 'group', imageMode: 'original_watermark', watermarkText: 'Marca' },
  ]
  const basic = buildEntitledGroupConfig({ groups: posts, groupTargets: [], planSubject: { plan: 'basic' } }).groups.postDetails
  assert.deepEqual(basic.map(d => d.imageMode), ['preview', 'original'])
  assert.equal(basic[0].channelButtonJid, null)
  assert.equal(basic[0].channelButtonName, null)
  const pro = buildEntitledGroupConfig({ groups: posts, groupTargets: [], planSubject: { plan: 'pro' } }).groups.postDetails
  assert.deepEqual(pro.map(d => d.imageMode), ['preview_watermark', 'original_watermark'])
  assert.equal(pro[0].channelButtonJid, '123@newsletter')
  const trial = buildEntitledGroupConfig({ groups: posts, groupTargets: [], planSubject: { plan: 'trial', accessExpiresAt: new Date(Date.now() + 86_400_000) } }).groups.postDetails
  assert.deepEqual(trial.map(d => d.imageMode), ['preview_watermark', 'original_watermark'])
})

// 2026-08-28: o modo de imagem deixou de ser único/global e passou a ser
// escolhido POR DESTINO. A origem (toMonitorGroup) nunca leu `imageMode` e
// continua sem lê-lo — nem fixo nem vindo do banco. `fallbackToOriginal`
// continua sempre ligado (rede de segurança preservada).
test('toMonitorGroup não expõe imageMode, mesmo quando a origem tem valores legados gravados', () => {
  const custom = [
    { id: 'm-default', role: 'monitor', waJid: 'a@g.us', kind: 'group', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-fetch', role: 'monitor', waJid: 'b@g.us', kind: 'group', imageMode: 'fetch', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
    { id: 'm-preview', role: 'monitor', waJid: 'd@g.us', kind: 'group', imageMode: 'preview', imageLinkTarget: 'first', forwardMode: 'LINK_ONLY' },
  ]
  const result = buildEntitledGroupConfig({ groups: custom, groupTargets: [], planSubject: { plan: 'pro' } })
  const byJid = Object.fromEntries(result.groups.monitor.map(g => [g.waJid, g]))

  for (const jid of ['a@g.us', 'b@g.us', 'd@g.us']) {
    assert.equal('imageMode' in byJid[jid], false, `toMonitorGroup não pode expor imageMode para ${jid}`)
    assert.equal(byJid[jid].fallbackToOriginal, true)
  }
})

// Cada destino escolhe seu próprio modo/marca — a mesma oferta pode sair
// 'original' num grupo, 'original_watermark' noutro e 'preview' num terceiro.
test('toPostDetail resolve imageMode/watermarkText por destino, com fallback seguro para valor ausente/desconhecido', () => {
  const custom = [
    { id: 'p-original', role: 'post', waJid: 'a@g.us', kind: 'group', imageMode: 'original' },
    { id: 'p-watermark', role: 'post', waJid: 'b@g.us', kind: 'group', imageMode: 'original_watermark', watermarkText: 'Achadinhos da Maria' },
    { id: 'p-preview', role: 'post', waJid: 'c@g.us', kind: 'group', imageMode: 'preview' },
    { id: 'p-legacy', role: 'post', waJid: 'd@g.us', kind: 'group', imageMode: 'legado-desconhecido' },
    { id: 'p-null', role: 'post', waJid: 'e@g.us', kind: 'group', imageMode: null },
  ]
  const result = buildEntitledGroupConfig({ groups: custom, groupTargets: [], planSubject: { plan: 'pro' } })
  const byJid = Object.fromEntries(result.groups.postDetails.map(g => [g.waJid, g]))

  assert.equal(byJid['a@g.us'].imageMode, 'original')
  assert.equal(byJid['a@g.us'].watermarkText, null)
  assert.equal(byJid['b@g.us'].imageMode, 'original_watermark')
  assert.equal(byJid['b@g.us'].watermarkText, 'Achadinhos da Maria')
  assert.equal(byJid['c@g.us'].imageMode, 'preview')
  assert.equal(byJid['d@g.us'].imageMode, 'original', 'valor desconhecido cai em original, nunca deixa o worker sem modo')
  assert.equal(byJid['e@g.us'].imageMode, 'original')
})

test('buildEntitledGroupConfig keeps channels for active trial and Pro', () => {
  const trial = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'trial', accessExpiresAt: new Date(Date.now() + 86400000) } })
  const pro = buildEntitledGroupConfig({ groups, groupTargets, planSubject: { plan: 'pro' } })

  assert.deepEqual(trial.groups.monitorJids, ['monitor@g.us', 'monitor@newsletter'])
  assert.deepEqual(pro.groups.post, ['post@g.us', 'post@newsletter'])
  assert.equal(trial.blockedChannelCount, 0)
  assert.equal(pro.blockedChannelCount, 0)
})
