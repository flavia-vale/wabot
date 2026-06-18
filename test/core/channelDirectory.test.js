import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getChannelMetadata } from '../../src/core/channelDirectory.js'
import { followChannel } from '../../src/core/channelDirectory.js'
import { listFollowedChannels } from '../../src/core/channelDirectory.js'

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

test('getChannelMetadata extrai nome quando name é objeto { text }', async () => {
  const sock = makeSock({
    newsletterMetadata: async () => ({ id: 'a@newsletter', name: { id: '1', text: 'Canal Objeto' }, owner: 'x@s.whatsapp.net' }),
  })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result.name, 'Canal Objeto')
})

test('getChannelMetadata extrai nome de thread_metadata.name.text', async () => {
  const sock = makeSock({
    newsletterMetadata: async () => ({ id: 'a@newsletter', thread_metadata: { name: { text: 'Canal Aninhado' } }, owner: 'x@s.whatsapp.net' }),
  })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result.name, 'Canal Aninhado')
})

test('getChannelMetadata sem nome em lugar nenhum vira string vazia', async () => {
  const sock = makeSock({
    newsletterMetadata: async () => ({ id: 'a@newsletter', owner: 'x@s.whatsapp.net' }),
  })
  const result = await getChannelMetadata({ sock, jid: 'a@newsletter' })
  assert.equal(result.name, '')
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

test('followChannel chama newsletterFollow e marca followedSet', async () => {
  const calls = []
  const sock = {
    newsletterFollow: async (jid) => { calls.push(['follow', jid]) },
    subscribeNewsletterUpdates: async (jid) => { calls.push(['sub', jid]); return { duration: 86400 } },
  }
  const followedSet = new Set()
  const inFlight = new Set()
  const result = await followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight })
  assert.deepEqual(result, { followed: 'new', duration: 86400 })
  assert.ok(followedSet.has('a@newsletter'))
  assert.equal(inFlight.has('a@newsletter'), false)
  assert.deepEqual(calls, [['follow', 'a@newsletter'], ['sub', 'a@newsletter']])
})

test('followChannel é idempotente — já seguido retorna "already" sem chamar Baileys', async () => {
  let called = false
  const sock = { newsletterFollow: async () => { called = true } }
  const followedSet = new Set(['a@newsletter'])
  const result = await followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight: new Set() })
  assert.deepEqual(result, { followed: 'already' })
  assert.equal(called, false)
})

test('followChannel detecta concorrência via inFlight e aguarda sem duplicar chamada', async () => {
  let calls = 0
  const sock = {
    newsletterFollow: async () => { calls++ },
    subscribeNewsletterUpdates: async () => ({ duration: 0 }),
  }
  const followedSet = new Set()
  const inFlight = new Set()
  const [a, b] = await Promise.all([
    followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight }),
    followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight }),
  ])
  assert.equal(calls, 1, 'apenas uma chamada efetiva ao newsletterFollow')
  const outcomes = [a.followed, b.followed].sort()
  assert.deepEqual(outcomes, ['in-flight', 'new'])
})

test('followChannel propaga erro de newsletterFollow e remove de inFlight', async () => {
  const sock = { newsletterFollow: async () => { throw new Error('forbidden') } }
  const inFlight = new Set()
  await assert.rejects(
    () => followChannel({ sock, jid: 'a@newsletter', followedSet: new Set(), inFlight }),
    /forbidden/,
  )
  assert.equal(inFlight.has('a@newsletter'), false, 'inFlight limpo mesmo em erro')
})

test('followChannel funciona quando subscribeNewsletterUpdates falha — só warn', async () => {
  const sock = {
    newsletterFollow: async () => {},
    subscribeNewsletterUpdates: async () => { throw new Error('subscribe-failed') },
  }
  const followedSet = new Set()
  const result = await followChannel({ sock, jid: 'a@newsletter', followedSet, inFlight: new Set() })
  assert.equal(result.followed, 'new')
  assert.equal(result.duration, null)
  assert.ok(followedSet.has('a@newsletter'))
})

test('listFollowedChannels resolve metadata em paralelo a partir de followedSet', async () => {
  const sock = {
    user: { id: 'me@s.whatsapp.net' },
    newsletterMetadata: async (type, key) => {
      assert.equal(type, 'jid')
      return { id: key, name: `Nome ${key}`, owner: 'me@s.whatsapp.net' }
    },
  }
  const followedSet = new Set(['a@newsletter', 'b@newsletter', 'c@newsletter'])
  const result = await listFollowedChannels({ sock, followedSet, concurrency: 2 })
  assert.equal(result.length, 3)
  assert.deepEqual(result.map(r => r.jid).sort(), ['a@newsletter', 'b@newsletter', 'c@newsletter'])
  for (const r of result) assert.equal(r.isViewerOwner, true)
})

test('listFollowedChannels tolera falha parcial — item com erro vira null', async () => {
  const sock = {
    user: { id: 'me@s.whatsapp.net' },
    newsletterMetadata: async (type, key) => {
      if (key === 'b@newsletter') throw new Error('boom')
      return { id: key, name: 'X', owner: 'someone@s.whatsapp.net' }
    },
  }
  const followedSet = new Set(['a@newsletter', 'b@newsletter'])
  const result = await listFollowedChannels({ sock, followedSet, concurrency: 5 })
  assert.equal(result.length, 1, 'item com erro é descartado')
  assert.equal(result[0].jid, 'a@newsletter')
})

test('listFollowedChannels com followedSet vazio retorna []', async () => {
  const sock = { newsletterMetadata: async () => { throw new Error('should-not-call') } }
  const result = await listFollowedChannels({ sock, followedSet: new Set() })
  assert.deepEqual(result, [])
})

test('listFollowedChannels: canal travado é pulado pelo timeout por canal', async () => {
  const sock = {
    user: { id: 'me@s.whatsapp.net' },
    newsletterMetadata: async (type, key) => {
      if (key === 'slow@newsletter') return new Promise(() => {}) // nunca resolve
      return { id: key, name: 'X', owner: 'me@s.whatsapp.net' }
    },
  }
  const followedSet = new Set(['fast@newsletter', 'slow@newsletter'])
  const start = Date.now()
  const result = await listFollowedChannels({ sock, followedSet, concurrency: 2, perCallTimeoutMs: 50, budgetMs: 5000 })
  assert.ok(Date.now() - start < 2000, 'não espera o canal travado')
  assert.deepEqual(result.map(r => r.jid), ['fast@newsletter'])
})

test('listFollowedChannels: deadline global retorna resultado parcial', async () => {
  const sock = {
    user: { id: 'me@s.whatsapp.net' },
    newsletterMetadata: async (type, key) => {
      await new Promise((r) => setTimeout(r, 40))
      return { id: key, name: 'X', owner: 'me@s.whatsapp.net' }
    },
  }
  const followedSet = new Set(Array.from({ length: 50 }, (_, i) => `c${i}@newsletter`))
  const start = Date.now()
  const result = await listFollowedChannels({ sock, followedSet, concurrency: 1, budgetMs: 120, perCallTimeoutMs: 1000 })
  const elapsed = Date.now() - start
  assert.ok(elapsed < 600, `retorna perto do budget (elapsed=${elapsed})`)
  assert.ok(result.length >= 1 && result.length < 50, `parcial (${result.length})`)
})
