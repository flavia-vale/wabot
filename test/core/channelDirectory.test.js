import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getChannelMetadata } from '../../src/core/channelDirectory.js'

function makeSock({ user = { id: '5511999999999:1@s.whatsapp.net' }, newsletterMetadata } = {}) {
  return { user, newsletterMetadata }
}

test('getChannelMetadata por jid retorna formato normalizado', async () => {
  const sock = makeSock({
    newsletterMetadata: async (type, key) => {
      assert.equal(type, 'jid')
      assert.equal(key, '123abc@newsletter')
      return { id: '123abc@newsletter', name: 'Canal X', owner: '5511999999999@s.whatsapp.net' }
    },
  })
  const result = await getChannelMetadata({ sock, jid: '123abc@newsletter' })
  assert.deepEqual(result, {
    jid: '123abc@newsletter',
    name: 'Canal X',
    owner: '5511999999999@s.whatsapp.net',
    isViewerOwner: true,
    picture: null,
  })
})

test('getChannelMetadata por inviteCode chama newsletterMetadata("invite", code)', async () => {
  const sock = makeSock({
    newsletterMetadata: async (type, key) => {
      assert.equal(type, 'invite')
      assert.equal(key, '0029Va123')
      return { id: 'xyz@newsletter', name: 'Outro', owner: 'someone@s.whatsapp.net' }
    },
  })
  const result = await getChannelMetadata({ sock, inviteCode: '0029Va123' })
  assert.equal(result.jid, 'xyz@newsletter')
  assert.equal(result.isViewerOwner, false)
})

test('getChannelMetadata normaliza owner com :device suffix do user atual', async () => {
  const sock = makeSock({
    user: { id: '5511999999999:7@s.whatsapp.net' },
    newsletterMetadata: async () => ({ id: 'a@newsletter', name: 'A', owner: '5511999999999@s.whatsapp.net' }),
  })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result.isViewerOwner, true)
})

test('getChannelMetadata retorna null quando newsletterMetadata retorna null', async () => {
  const sock = makeSock({ newsletterMetadata: async () => null })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result, null)
})

test('getChannelMetadata propaga erro do Baileys', async () => {
  const sock = makeSock({ newsletterMetadata: async () => { throw new Error('not-found') } })
  await assert.rejects(
    () => getChannelMetadata({ sock, jid: 'a@newsletter' }),
    /not-found/,
  )
})

test('getChannelMetadata exige jid OU inviteCode', async () => {
  const sock = makeSock({ newsletterMetadata: async () => ({}) })
  await assert.rejects(
    () => getChannelMetadata({ sock }),
    /jid ou inviteCode/,
  )
})
