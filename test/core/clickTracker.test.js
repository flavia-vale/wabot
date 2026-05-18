import test from 'node:test'
import assert from 'node:assert/strict'

import {
  generateHash,
  hashIp,
  hashUserAgent,
  createShortlink,
  resolveShortlink,
  recordClick,
  getClickStats,
} from '../../src/core/clickTracker.js'

// ---------- helpers puros ----------

test('generateHash retorna 8 chars base64url', () => {
  const h = generateHash()
  assert.equal(h.length, 8)
  assert.ok(/^[A-Za-z0-9_-]+$/.test(h))
})

test('generateHash é único entre chamadas', () => {
  const seen = new Set()
  for (let i = 0; i < 100; i++) seen.add(generateHash())
  assert.equal(seen.size, 100)
})

test('hashIp é determinístico e mascara o IP real', () => {
  const a = hashIp('192.168.0.1')
  const b = hashIp('192.168.0.1')
  const c = hashIp('192.168.0.2')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.equal(a.length, 64) // SHA-256 hex
  assert.equal(a.includes('192.168'), false)
})

test('hashIp aceita null/undefined', () => {
  assert.equal(hashIp(null), null)
  assert.equal(hashIp(undefined), null)
  assert.equal(hashIp(''), null)
})

test('hashUserAgent funciona análogo ao hashIp', () => {
  const a = hashUserAgent('Mozilla/5.0 (X11)')
  const b = hashUserAgent('Mozilla/5.0 (X11)')
  assert.equal(a, b)
  assert.equal(a.length, 64)
})

// ---------- I/O com fake db ----------

function makeFakeDb({ links = new Map(), clicks = [] } = {}) {
  return {
    _links: links,
    _clicks: clicks,
    affiliateLink: {
      create: async ({ data }) => {
        const row = { id: 'l-' + (links.size + 1), createdAt: new Date(), ...data }
        links.set(row.hash, row)
        return row
      },
      findUnique: async ({ where }) => links.get(where.hash) ?? null,
    },
    affiliateClick: {
      create: async ({ data }) => {
        const row = { id: 'c-' + (clicks.length + 1), clickedAt: new Date(), ...data }
        clicks.push(row)
        return row
      },
      count: async ({ where }) => {
        let filtered = clicks
        if (where?.link?.userId) {
          const linkIds = new Set([...links.values()].filter(l => l.userId === where.link.userId).map(l => l.id))
          filtered = filtered.filter(c => linkIds.has(c.linkId))
        }
        if (where?.link?.groupId) {
          const linkIds = new Set([...links.values()].filter(l => l.groupId === where.link.groupId).map(l => l.id))
          filtered = filtered.filter(c => linkIds.has(c.linkId))
        }
        if (where?.clickedAt?.gte) {
          filtered = filtered.filter(c => c.clickedAt >= where.clickedAt.gte)
        }
        return filtered.length
      },
    },
  }
}

test('createShortlink persiste link e retorna hash + URL', async () => {
  const db = makeFakeDb()
  const result = await createShortlink('u-1', 'https://amzn.to/xyz', { db, baseUrl: 'https://s.bot' })
  assert.ok(result.hash)
  assert.equal(result.shortUrl, `https://s.bot/r/${result.hash}`)
  assert.equal(db._links.get(result.hash).originalUrl, 'https://amzn.to/xyz')
  assert.equal(db._links.get(result.hash).userId, 'u-1')
})

test('createShortlink aceita opções groupId e messageLogId', async () => {
  const db = makeFakeDb()
  const result = await createShortlink('u-1', 'https://ex.com', {
    db, baseUrl: 'https://s.bot', groupId: 'g-1', messageLogId: 'm-1',
  })
  const stored = db._links.get(result.hash)
  assert.equal(stored.groupId, 'g-1')
  assert.equal(stored.messageLogId, 'm-1')
})

test('createShortlink rejeita URL vazia ou inválida', async () => {
  const db = makeFakeDb()
  await assert.rejects(() => createShortlink('u-1', '', { db }), /URL/)
  await assert.rejects(() => createShortlink('u-1', null, { db }), /URL/)
})

test('resolveShortlink retorna link ou null', async () => {
  const db = makeFakeDb()
  const created = await createShortlink('u-1', 'https://ex.com', { db, baseUrl: 'https://s.bot' })
  const found = await resolveShortlink(created.hash, { db })
  assert.equal(found.originalUrl, 'https://ex.com')
  const missing = await resolveShortlink('nonexistent', { db })
  assert.equal(missing, null)
})

test('recordClick persiste click com hashes', async () => {
  const db = makeFakeDb()
  const link = await createShortlink('u-1', 'https://ex.com', { db, baseUrl: 'https://s.bot' })
  const linkRow = db._links.get(link.hash)
  await recordClick(linkRow.id, { ip: '10.0.0.1', userAgent: 'curl/1' }, { db })
  assert.equal(db._clicks.length, 1)
  assert.ok(db._clicks[0].ipHash)
  assert.ok(db._clicks[0].uaHash)
  // não armazena IP em claro
  assert.equal(db._clicks[0].ipHash.includes('10.0.0.1'), false)
})

test('recordClick tolera ip/userAgent ausente', async () => {
  const db = makeFakeDb()
  const link = await createShortlink('u-1', 'https://ex.com', { db, baseUrl: 'https://s.bot' })
  const linkRow = db._links.get(link.hash)
  await recordClick(linkRow.id, {}, { db })
  assert.equal(db._clicks[0].ipHash, null)
  assert.equal(db._clicks[0].uaHash, null)
})

test('getClickStats agrega por groupId e janela de dias', async () => {
  const db = makeFakeDb()
  const a = await createShortlink('u-1', 'https://a.com', { db, baseUrl: 'https://s.bot', groupId: 'g-1' })
  const b = await createShortlink('u-1', 'https://b.com', { db, baseUrl: 'https://s.bot', groupId: 'g-2' })
  const aRow = db._links.get(a.hash)
  const bRow = db._links.get(b.hash)
  await recordClick(aRow.id, { ip: '1.1.1.1' }, { db })
  await recordClick(aRow.id, { ip: '2.2.2.2' }, { db })
  await recordClick(bRow.id, { ip: '3.3.3.3' }, { db })

  const statsA = await getClickStats({ db, groupId: 'g-1', days: 7 })
  const statsB = await getClickStats({ db, groupId: 'g-2', days: 7 })
  assert.equal(statsA.total, 2)
  assert.equal(statsB.total, 1)
})
