import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { couponsRoutes } from '../src/api/routes/coupons.js'

let userCounter = 0

async function buildApp({ userIdOverride } = {}) {
  const n = ++userCounter
  const userId = userIdOverride || `user-coupons-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (!userIdOverride) {
    await db.user.create({
      data: {
        id: userId,
        name: `Coupons Test ${n}`,
        email: `coupons-${n}-${Date.now()}@coupons-route-test.local`,
        passwordHash: 'x',
        plan: 'pro',
      },
    })
  }
  const reloadCalls = []
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app.register(couponsRoutes, {
    prefix: '/api/coupons',
    reloadConfig: async (uid) => { reloadCalls.push(uid); return true },
  })
  return { app, userId, reloadCalls }
}

async function cleanup(userId) {
  await db.clientCoupon.deleteMany({ where: { userId } })
  await db.user.deleteMany({ where: { id: userId } })
}

function samplePayload(overrides = {}) {
  return {
    code: 'BEMVINDO10',
    platform: 'shopee',
    discountType: 'percent',
    discountValue: 10,
    ...overrides,
  }
}

test('POST cria cupom e GET lista do mais novo para o mais antigo, com expired calculado', async () => {
  const { app, userId } = await buildApp()
  try {
    const resA = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ code: 'AAA' }) })
    assert.equal(resA.statusCode, 201)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const resB = await app.inject({
      method: 'POST',
      url: '/api/coupons',
      payload: samplePayload({ code: 'BBB', validUntil: '2020-01-01T00:00:00.000Z' }),
    })
    assert.equal(resB.statusCode, 201)

    const list = JSON.parse((await app.inject({ method: 'GET', url: '/api/coupons' })).body)
    assert.equal(list.coupons.length, 2)
    // mais novo primeiro
    assert.equal(list.coupons[0].code, 'BBB')
    assert.equal(list.coupons[0].expired, true)
    assert.equal(list.coupons[1].code, 'AAA')
    assert.equal(list.coupons[1].expired, false)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('POST recusa sem code/platform/discountType/discountValue com mensagem em português', async () => {
  const { app, userId } = await buildApp()
  try {
    const semCode = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ code: '' }) })
    assert.equal(semCode.statusCode, 400)
    assert.match(JSON.parse(semCode.body).error, /código do cupom/)

    const semPlatform = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ platform: '' }) })
    assert.equal(semPlatform.statusCode, 400)
    assert.match(JSON.parse(semPlatform.body).error, /qual loja/)

    const platformInvalida = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ platform: 'loja-fantasma' }) })
    assert.equal(platformInvalida.statusCode, 400)
    assert.match(JSON.parse(platformInvalida.body).error, /não é aceita/)

    const semTipo = await app.inject({ method: 'POST', url: '/api/coupons', payload: { code: 'X', platform: 'shopee', discountValue: 10 } })
    assert.equal(semTipo.statusCode, 400)

    const semValor = await app.inject({ method: 'POST', url: '/api/coupons', payload: { code: 'X', platform: 'shopee', discountType: 'percent' } })
    assert.equal(semValor.statusCode, 400)

    // Nenhuma mensagem pode conter o nome técnico do campo.
    for (const res of [semCode, semPlatform, platformInvalida, semTipo, semValor]) {
      const body = JSON.parse(res.body)
      assert.doesNotMatch(body.error, /platform|discountType|discountValue/)
    }
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('POST recusa percent fora de 1-100 e amount <= 0', async () => {
  const { app, userId } = await buildApp()
  try {
    const percentBaixo = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ discountType: 'percent', discountValue: 0 }) })
    assert.equal(percentBaixo.statusCode, 400)
    assert.match(JSON.parse(percentBaixo.body).error, /entre 1 e 100/)

    const percentAlto = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ discountType: 'percent', discountValue: 101 }) })
    assert.equal(percentAlto.statusCode, 400)

    const amountZero = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ discountType: 'amount', discountValue: 0 }) })
    assert.equal(amountZero.statusCode, 400)
    assert.match(JSON.parse(amountZero.body).error, /maior que zero/)

    const amountNegativo = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ discountType: 'amount', discountValue: -100 }) })
    assert.equal(amountNegativo.statusCode, 400)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('POST recusa validUntil ilegível', async () => {
  const { app, userId } = await buildApp()
  try {
    const res = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ validUntil: 'não é uma data' }) })
    assert.equal(res.statusCode, 400)
    assert.match(JSON.parse(res.body).error, /data de validade/)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('POST com código repetido devolve 201 com duplicateWarning:true, nunca 409', async () => {
  const { app, userId } = await buildApp()
  try {
    const first = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })
    assert.equal(first.statusCode, 201)
    assert.ok(!JSON.parse(first.body).duplicateWarning)

    const second = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })
    assert.equal(second.statusCode, 201)
    assert.equal(JSON.parse(second.body).duplicateWarning, true)

    const list = JSON.parse((await app.inject({ method: 'GET', url: '/api/coupons' })).body)
    assert.equal(list.coupons.length, 2)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('código igual em loja diferente NÃO é duplicata', async () => {
  const { app, userId } = await buildApp()
  try {
    await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ platform: 'shopee' }) })
    const res = await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload({ platform: 'amazon' }) })
    assert.equal(res.statusCode, 201)
    assert.ok(!JSON.parse(res.body).duplicateWarning)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('PUT aceita campos opcionais e 404 para cupom de outra cliente', async () => {
  const { app: appA, userId: userA } = await buildApp()
  const { app: appB, userId: userB } = await buildApp()
  try {
    const created = JSON.parse((await appA.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })).body)

    const updated = JSON.parse((await appA.inject({
      method: 'PUT',
      url: `/api/coupons/${created.id}`,
      payload: { label: 'Cupom de boas-vindas' },
    })).body)
    assert.equal(updated.label, 'Cupom de boas-vindas')
    assert.equal(updated.code, 'BEMVINDO10') // não mudou o que não foi enviado

    const forbidden = await appB.inject({ method: 'PUT', url: `/api/coupons/${created.id}`, payload: { label: 'Invasão' } })
    assert.equal(forbidden.statusCode, 404)
  } finally {
    await cleanup(userA)
    await cleanup(userB)
    await appA.close()
    await appB.close()
  }
})

test('PATCH /:id/enabled alterna enabled e chama o reload', async () => {
  const { app, userId, reloadCalls } = await buildApp()
  try {
    const created = JSON.parse((await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })).body)
    reloadCalls.length = 0

    const off = JSON.parse((await app.inject({ method: 'PATCH', url: `/api/coupons/${created.id}/enabled`, payload: { enabled: false } })).body)
    assert.equal(off.enabled, false)
    assert.ok(reloadCalls.includes(userId))

    const on = JSON.parse((await app.inject({ method: 'PATCH', url: `/api/coupons/${created.id}/enabled`, payload: { enabled: true } })).body)
    assert.equal(on.enabled, true)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('DELETE é idempotente: 200 com deleted:false quando já não existe', async () => {
  const { app, userId } = await buildApp()
  try {
    const created = JSON.parse((await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })).body)
    const first = await app.inject({ method: 'DELETE', url: `/api/coupons/${created.id}` })
    assert.equal(first.statusCode, 200)
    assert.equal(JSON.parse(first.body).deleted, true)

    const second = await app.inject({ method: 'DELETE', url: `/api/coupons/${created.id}` })
    assert.equal(second.statusCode, 200)
    assert.equal(JSON.parse(second.body).deleted, false)

    const bogus = await app.inject({ method: 'DELETE', url: '/api/coupons/id-que-nunca-existiu' })
    assert.equal(bogus.statusCode, 200)
    assert.equal(JSON.parse(bogus.body).deleted, false)
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('FR-007: toda rota é escopada por req.user.sub — cliente A nunca lista/edita/apaga cupom de cliente B', async () => {
  const { app: appA, userId: userA } = await buildApp()
  const { app: appB, userId: userB } = await buildApp()
  try {
    const created = JSON.parse((await appA.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })).body)

    const listB = JSON.parse((await appB.inject({ method: 'GET', url: '/api/coupons' })).body)
    assert.equal(listB.coupons.length, 0)

    const patchB = await appB.inject({ method: 'PATCH', url: `/api/coupons/${created.id}/enabled`, payload: { enabled: false } })
    assert.equal(patchB.statusCode, 404)

    const deleteB = await appB.inject({ method: 'DELETE', url: `/api/coupons/${created.id}` })
    assert.equal(JSON.parse(deleteB.body).deleted, false)

    // O cupom de A continua intacto e ligado.
    const stillThere = await db.clientCoupon.findUnique({ where: { id: created.id } })
    assert.ok(stillThere)
    assert.equal(stillThere.enabled, true)
  } finally {
    await cleanup(userA)
    await cleanup(userB)
    await appA.close()
    await appB.close()
  }
})

test('toda escrita chama reloadWorkerConfig (await, nunca Promise crua)', async () => {
  const { app, userId, reloadCalls } = await buildApp()
  try {
    const created = JSON.parse((await app.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })).body)
    await app.inject({ method: 'PUT', url: `/api/coupons/${created.id}`, payload: { label: 'x' } })
    await app.inject({ method: 'PATCH', url: `/api/coupons/${created.id}/enabled`, payload: { enabled: false } })
    await app.inject({ method: 'DELETE', url: `/api/coupons/${created.id}` })
    assert.equal(reloadCalls.length, 4)
    assert.ok(reloadCalls.every((id) => id === userId))
  } finally {
    await cleanup(userId)
    await app.close()
  }
})

test('falha do reload não reprova a requisição (best-effort)', async () => {
  const { app, userId } = await buildApp()
  // Substitui reloadConfig por um que lança — a escrita continua valendo.
  await app.close()
  const app2 = Fastify({ logger: false })
  app2.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  await app2.register(couponsRoutes, {
    prefix: '/api/coupons',
    reloadConfig: async () => { throw new Error('supervisor fora do ar') },
  })
  try {
    const res = await app2.inject({ method: 'POST', url: '/api/coupons', payload: samplePayload() })
    assert.equal(res.statusCode, 201)
  } finally {
    await cleanup(userId)
    await app2.close()
  }
})
