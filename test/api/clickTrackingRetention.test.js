import { test } from 'node:test'
import assert from 'node:assert/strict'
import db from '../../src/db.js'
import { pruneClickTracking } from '../../src/api/clickTrackingRetention.js'

const DAY = 24 * 60 * 60 * 1000

test('pruneClickTracking apaga clique > 90 dias e link curto > 180 dias, mantém o resto', async (t) => {
  const userId = 'user-click-retencao'
  const now = Date.now()
  const ago = (days) => new Date(now - days * DAY)
  await db.user.create({ data: { id: userId, name: 'R', email: 'click-retencao@t.local', passwordHash: 'x' } })
  t.after(async () => {
    await db.affiliateLink.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  const recente = await db.affiliateLink.create({ data: { userId, hash: 'retRec01', originalUrl: 'https://shopee.com.br/a', createdAt: ago(10) } })
  const velho = await db.affiliateLink.create({ data: { userId, hash: 'retOld01', originalUrl: 'https://shopee.com.br/b', createdAt: ago(200) } })
  await db.affiliateClick.createMany({
    data: [
      { linkId: recente.id, clickedAt: ago(5) },
      { linkId: recente.id, clickedAt: ago(95) },
      { linkId: velho.id, clickedAt: ago(1) },
    ],
  })

  const result = await pruneClickTracking({ db, now })

  assert.equal(result.clicks, 1, 'só o clique de 95 dias sai pela regra de 90 dias')
  assert.equal(result.links, 1, 'só o link de 200 dias sai pela regra de 180 dias')
  const links = await db.affiliateLink.findMany({ where: { userId }, select: { hash: true } })
  assert.deepEqual(links.map(l => l.hash), ['retRec01'], 'link recente continua redirecionando')
  const clicks = await db.affiliateClick.findMany({ where: { link: { userId } } })
  assert.equal(clicks.length, 1, 'clique recente fica; clique do link velho some junto com ele (cascade)')
})

test('pruneClickTracking com retenção 0 ou inválida não apaga nada', async () => {
  const calls = []
  const fakeDb = {
    affiliateClick: { deleteMany: async (a) => { calls.push(a); return { count: 9 } } },
    affiliateLink: { deleteMany: async (a) => { calls.push(a); return { count: 9 } } },
  }
  const result = await pruneClickTracking({ db: fakeDb, clickDays: 0, linkDays: Number.NaN })
  assert.deepEqual(result, { clicks: 0, links: 0 })
  assert.equal(calls.length, 0)
})
