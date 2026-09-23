import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import db from '../src/db.js'
import { groupsRoutes } from '../src/api/routes/groups.js'

// 2026-08-28: a estratégia de imagem passa a ser escolhida por DESTINO
// (role='post'). Todo grupo novo nasce com imageMode='original' — "a foto
// que veio na oferta", padrão do produto desde 2026-08-21 — independente do
// role (role='monitor' nunca leu este campo, mas mantemos um único valor por
// simplicidade de schema).

let userCounter = 0

async function buildApp({ plan = 'pro', accessExpiresAt = null } = {}) {
  const n = ++userCounter
  const userId = `user-image-mode-${n}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await db.user.create({
    data: {
      id: userId,
      name: `Image Mode Test User ${n}`,
      email: `image-mode-test-${n}-${Date.now()}@groups-route-test.local`,
      passwordHash: 'x',
      plan,
      accessExpiresAt,
    },
  })
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (req) => { req.user = { sub: userId } })
  app.addHook('onClose', async () => {
    await db.groupTarget.deleteMany({ where: { userId } })
    await db.group.deleteMany({ where: { userId } })
    await db.user.deleteMany({ where: { id: userId } })
  })
  await app.register(groupsRoutes, {
    prefix: '/api/groups',
    channelMetadata: async () => null,
    followChannelImmediate: async () => ({ followed: 'new' }),
    listFollowedChannels: async () => [],
    isRunning: () => true,
  })
  return { app, userId }
}

test('POST / cria grupo role=monitor sem imageMode explícito → persiste imageMode=original', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-original@g.us', name: 'Grupo Monitor', role: 'monitor', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

test('POST / cria grupo role=post sem imageMode explícito → também persiste imageMode=original', async () => {
  const { app } = await buildApp()
  const res = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-original@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

test('PUT /:id recusa imageMode/watermarkText em grupo role=monitor (origem)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-guard@g.us', name: 'Grupo Monitor', role: 'monitor', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview' } })
  assert.equal(putRes.statusCode, 400)

  const putRes2 = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { watermarkText: 'Minha marca' } })
  assert.equal(putRes2.statusCode, 400)
  await app.close()
})

test('PUT /:id aceita original/original_watermark/preview em grupo role=post (destino)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-guard@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  for (const imageMode of ['preview', 'original']) {
    const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode } })
    assert.equal(putRes.statusCode, 200)
    assert.equal(JSON.parse(putRes.body).imageMode, imageMode)
  }

  const withWatermark = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'original_watermark', watermarkText: 'Achadinhos Maria' } })
  assert.equal(withWatermark.statusCode, 200)
  const body = JSON.parse(withWatermark.body)
  assert.equal(body.imageMode, 'original_watermark')
  assert.equal(body.watermarkText, 'Achadinhos Maria')
  await app.close()
})

// 2026-08-30: `preview_watermark` (card clicável com a marca na foto) saiu do
// "em breve" — o worker passou a compor a marca no card. A rota agora aceita o
// modo, com a MESMA exigência do par sem card: sem texto de marca não adianta
// ligar, então continua 400.
test('PUT /:id aceita preview_watermark com texto de marca', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-preview-watermark@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview_watermark', watermarkText: 'Ofertas da Ana' } })
  assert.equal(putRes.statusCode, 200)
  const saved = await db.group.findUnique({ where: { id } })
  assert.equal(saved.imageMode, 'preview_watermark')
  assert.equal(saved.watermarkText, 'Ofertas da Ana')
  await app.close()
})

test('PUT /:id recusa preview_watermark sem texto de marca', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-preview-wm-sem-texto@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview_watermark' } })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})

test('PUT /:id recusa modo de imagem desconhecido', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-modo-invalido@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'fetch' } })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})

test('PUT /:id recusa original_watermark sem texto de marca', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-no-text@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'original_watermark' } })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})

test('PUT /:id recusa texto de marca acima de 25 caracteres (contagem por codepoint)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-too-long@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { imageMode: 'original_watermark', watermarkText: 'x'.repeat(26) },
  })
  assert.equal(putRes.statusCode, 400)

  const putOk = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { imageMode: 'original_watermark', watermarkText: 'x'.repeat(25) },
  })
  assert.equal(putOk.statusCode, 200)
  await app.close()
})

// specs/012-shein-store-support (T020/T025): 'shein' entrou na whitelist de
// allowedPlatforms — PUT /:id não pode mais recusá-la como "plataforma
// inválida".
test('PUT /:id aceita shein na whitelist de allowedPlatforms', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-shein@g.us', name: 'Grupo Monitor Shein', role: 'monitor', kind: 'group' } })
  assert.equal(createRes.statusCode, 200)
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { allowedPlatforms: 'shopee,amazon,mercadolivre,magazineluiza,shein' },
  })
  assert.equal(putRes.statusCode, 200)
  assert.equal(JSON.parse(putRes.body).allowedPlatforms, 'shopee,amazon,mercadolivre,magazineluiza,shein')
  await app.close()
})

test('PUT /:id ainda recusa plataforma realmente inválida', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-invalid@g.us', name: 'Grupo Monitor Inválido', role: 'monitor', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { allowedPlatforms: 'shein,naoexiste' },
  })
  assert.equal(putRes.statusCode, 400)
  await app.close()
})

// Botão "Ver canal" e card clicável não convivem: o WhatsApp só aceita o botão
// em corpo de mídia. Em vez de guardar uma escolha que nunca vai valer, a rota
// grava já o formato que de fato vai sair — assim o painel mostra a verdade em
// vez de prometer um card que o WhatsApp derruba.
test('PUT /:id troca o card por foto ao ligar o botão "Ver canal"', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-botao-card@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview' } })
  const comBotao = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '120363000000000000@newsletter', channelButtonName: 'Meu canal' } })
  assert.equal(comBotao.statusCode, 200)
  assert.equal(JSON.parse(comBotao.body).imageMode, 'original')
  await app.close()
})

// A marca d'água não pode se perder na troca — antes disso, card com marca +
// botão saía como foto SEM marca, em silêncio.
test('PUT /:id preserva a marca ao trocar o card por foto', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-botao-marca@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview_watermark', watermarkText: 'Ofertas da Ana' } })
  const comBotao = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '120363000000000000@newsletter', channelButtonName: 'Meu canal' } })
  const salvo = JSON.parse(comBotao.body)
  assert.equal(salvo.imageMode, 'original_watermark')
  assert.equal(salvo.watermarkText, 'Ofertas da Ana')
  await app.close()
})

// Escolher o card num destino que JÁ tem botão também degrada — senão a tela
// mostraria "card" e a oferta sairia como foto.
test('PUT /:id degrada o card escolhido num destino que já tem botão', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-ja-com-botao@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '120363000000000000@newsletter', channelButtonName: 'Meu canal' } })
  const res = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview' } })
  assert.equal(JSON.parse(res.body).imageMode, 'original')
  await app.close()
})

// Removido o botão, o card volta a ser escolhível — a degradação é do momento
// em que o botão existe, não uma porta de mão única.
test('PUT /:id volta a aceitar o card depois de remover o botão', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-botao-removido@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '120363000000000000@newsletter', channelButtonName: 'Meu canal' } })
  await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '', channelButtonName: '' } })
  const res = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview' } })
  assert.equal(JSON.parse(res.body).imageMode, 'preview')
  await app.close()
})

// Tamanho e posição da marca: mesmo destino de watermarkColor — só aceito em
// role=post e com valores conhecidos, mas sem exigir modo de marca ligado
// (a cliente pode preparar tamanho/posição antes de ligar a marca).
test('PUT /:id aceita watermarkSize e watermarkPosition em grupo role=post', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-size-position@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putRes = await app.inject({
    method: 'PUT',
    url: `/api/groups/${id}`,
    payload: { imageMode: 'original_watermark', watermarkText: 'Ofertas da Ana', watermarkSize: 'large', watermarkPosition: 'top-right' },
  })
  assert.equal(putRes.statusCode, 200)
  const body = JSON.parse(putRes.body)
  assert.equal(body.watermarkSize, 'large')
  assert.equal(body.watermarkPosition, 'top-right')

  const saved = await db.group.findUnique({ where: { id } })
  assert.equal(saved.watermarkSize, 'large')
  assert.equal(saved.watermarkPosition, 'top-right')
  await app.close()
})

test('PUT /:id recusa watermarkSize/watermarkPosition inválidos', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'post-size-invalido@g.us', name: 'Grupo Destino', role: 'post', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const badSize = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { watermarkSize: 'gigante' } })
  assert.equal(badSize.statusCode, 400)

  const badPosition = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { watermarkPosition: 'diagonal' } })
  assert.equal(badPosition.statusCode, 400)
  await app.close()
})

test('PUT /:id recusa watermarkSize/watermarkPosition em grupo role=monitor (origem)', async () => {
  const { app } = await buildApp()
  const createRes = await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'monitor-size-position@g.us', name: 'Grupo Origem', role: 'monitor', kind: 'group' } })
  const { id } = JSON.parse(createRes.body)

  const putSize = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { watermarkSize: 'large' } })
  assert.equal(putSize.statusCode, 400)

  const putPosition = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { watermarkPosition: 'top-right' } })
  assert.equal(putPosition.statusCode, 400)
  await app.close()
})

// Divisão Basic/PRO (2026-09-23): marca d'água e botão "Ver canal" são do PRO.
const umDia = () => new Date(Date.now() + 86_400_000)

test('Basic: ligar marca d\'água devolve 403 e não grava', async () => {
  const { app } = await buildApp({ plan: 'basic', accessExpiresAt: umDia() })
  const { id } = JSON.parse((await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'basic-wm@g.us', name: 'D', role: 'post', kind: 'group' } })).body)
  const res = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'preview_watermark', watermarkText: 'Marca' } })
  assert.equal(res.statusCode, 403)
  assert.equal(res.json().feature, 'watermark')
  assert.equal((await db.group.findUnique({ where: { id } })).imageMode, 'original')
  await app.close()
})

test('Basic: ligar o botão "Ver canal" devolve 403; remover segue liberado', async () => {
  const { app } = await buildApp({ plan: 'basic', accessExpiresAt: umDia() })
  const { id } = JSON.parse((await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'basic-btn@g.us', name: 'D', role: 'post', kind: 'group' } })).body)
  const liga = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '120363000000000001@newsletter' } })
  assert.equal(liga.statusCode, 403)
  assert.equal(liga.json().feature, 'channel_button')
  const remove = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { channelButtonJid: '' } })
  assert.equal(remove.statusCode, 200)
  await app.close()
})

test('Basic com escolha antiga: a tela mostra sem marca, e salvar outra coisa grava sem marca e sem botão', async () => {
  const { app, userId } = await buildApp({ plan: 'basic', accessExpiresAt: umDia() })
  const card = await db.group.create({ data: { userId, waJid: 'legado-card@g.us', name: 'Card', role: 'post', kind: 'group', imageMode: 'preview_watermark', watermarkText: 'Marca', channelButtonJid: '120363000000000002@newsletter', channelButtonName: 'Canal' } })
  const foto = await db.group.create({ data: { userId, waJid: 'legado-foto@g.us', name: 'Foto', role: 'post', kind: 'group', imageMode: 'original_watermark', watermarkText: 'Marca' } })
  const lista = (await app.inject({ method: 'GET', url: '/api/groups' })).json()
  const byId = Object.fromEntries(lista.map(g => [g.id, g]))
  assert.equal(byId[card.id].imageMode, 'preview')
  assert.equal(byId[card.id].channelButtonJid, null)
  assert.equal(byId[foto.id].imageMode, 'original')

  assert.equal((await app.inject({ method: 'PUT', url: `/api/groups/${foto.id}`, payload: { welcomeMsg: 'oi' } })).statusCode, 200)
  assert.equal((await db.group.findUnique({ where: { id: foto.id } })).imageMode, 'original')
  assert.equal((await app.inject({ method: 'PUT', url: `/api/groups/${card.id}`, payload: { welcomeMsg: 'oi' } })).statusCode, 200)
  const salvo = await db.group.findUnique({ where: { id: card.id } })
  assert.equal(salvo.channelButtonJid, null)
  assert.equal(salvo.imageMode, 'preview')
  assert.equal(salvo.watermarkText, 'Marca')
  await app.close()
})

test('Trial ativo segue podendo ligar marca d\'água (herda o PRO)', async () => {
  const { app } = await buildApp({ plan: 'trial', accessExpiresAt: umDia() })
  const { id } = JSON.parse((await app.inject({ method: 'POST', url: '/api/groups', payload: { waJid: 'trial-wm@g.us', name: 'D', role: 'post', kind: 'group' } })).body)
  const res = await app.inject({ method: 'PUT', url: `/api/groups/${id}`, payload: { imageMode: 'original_watermark', watermarkText: 'Marca' } })
  assert.equal(res.statusCode, 200)
  await app.close()
})
