import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAddToGroupUrl, handleLinkUpdate, parseStartCommand } from '../src/delivery/telegram/link.js'

// Feature 017, Fatia 3 (US2): o grupo chega à conta certa pelo link de um
// toque — a cliente não copia nada.

test('link oficial do Telegram para adicionar o robô com o código da conta', () => {
  assert.equal(buildAddToGroupUrl('EspelhaGruposBot', 'abcDEF123_-x'), 'https://t.me/EspelhaGruposBot?startgroup=abcDEF123_-x&admin=post_messages')
  assert.equal(buildAddToGroupUrl(null, 'x'), null)
})

test('lê /start com código, com e sem o nome do robô', () => {
  assert.equal(parseStartCommand('/start abcDEF123', 'Bot'), 'abcDEF123')
  assert.equal(parseStartCommand('/start@EspelhaGruposBot abcDEF123', 'espelhagruposbot'), 'abcDEF123')
  assert.equal(parseStartCommand('/start@OutroBot abcDEF123', 'EspelhaGruposBot'), null)
  assert.equal(parseStartCommand('/start', 'Bot'), null)
  assert.equal(parseStartCommand('oferta boa', 'Bot'), null)
})

function fakeDb({ links = [], groups = [] } = {}) {
  const state = { groups: [...groups], created: [], updated: [] }
  return {
    state,
    deliveryNetworkLink: { findUnique: async ({ where }) => links.find((l) => l.linkCode === where.linkCode) ?? null },
    group: {
      findFirst: async ({ where }) => state.groups.find((g) => g.userId === where.userId && g.waJid === where.waJid && g.role === where.role) ?? null,
      count: async ({ where }) => state.groups.filter((g) => g.userId === where.userId).length,
      create: async ({ data }) => { const g = { id: `g${state.groups.length + 1}`, ...data }; state.groups.push(g); state.created.push(g); return g },
      update: async (args) => { state.updated.push(args); return {} },
      updateMany: async (args) => { state.updated.push(args); return { count: 1 } },
    },
  }
}

const deps = (db, { allowed = true } = {}) => ({
  db,
  adapter: { migrateDestination: async (...a) => { db.state.migrated = a } },
  canUseMultiNetwork: async () => allowed,
  botUsername: async () => 'EspelhaGruposBot',
})

const startIn = (chat, text = '/start CODIGO1234') => ({ update_id: 1, message: { chat, text } })

test('código válido em grupo cadastra o grupo como destino do Telegram da conta', async () => {
  const db = fakeDb({ links: [{ userId: 'u1', deliveryNetwork: 'telegram', linkCode: 'CODIGO1234' }] })
  const r = await handleLinkUpdate(startIn({ id: -100555, type: 'supergroup', title: 'Ofertas TG' }), deps(db))
  assert.equal(r.acao, 'cadastrado')
  assert.deepEqual(
    { userId: db.state.created[0].userId, waJid: db.state.created[0].waJid, role: db.state.created[0].role, deliveryNetwork: db.state.created[0].deliveryNetwork, name: db.state.created[0].name },
    { userId: 'u1', waJid: 'tg:-100555', role: 'post', deliveryNetwork: 'telegram', name: 'Ofertas TG' },
  )
})

test('repetir o link no mesmo grupo não duplica', async () => {
  const db = fakeDb({
    links: [{ userId: 'u1', deliveryNetwork: 'telegram', linkCode: 'CODIGO1234' }],
    groups: [{ id: 'g1', userId: 'u1', waJid: 'tg:-1', role: 'post' }],
  })
  const r = await handleLinkUpdate(startIn({ id: -1, type: 'group', title: 'Novo nome' }), deps(db))
  assert.equal(r.acao, 'atualizado')
  assert.equal(db.state.created.length, 0)
})

test('sem plano Premium, código desconhecido, conversa privada ou grupo que já é origem: nada é cadastrado', async () => {
  const links = [{ userId: 'u1', deliveryNetwork: 'telegram', linkCode: 'CODIGO1234' }]
  let db = fakeDb({ links })
  assert.equal((await handleLinkUpdate(startIn({ id: -1, type: 'group' }), deps(db, { allowed: false }))).acao, 'sem_plano')
  assert.equal((await handleLinkUpdate(startIn({ id: -1, type: 'group' }, '/start OUTROCODIGO'), deps(db))).acao, 'codigo_desconhecido')
  assert.equal((await handleLinkUpdate(startIn({ id: 5, type: 'private' }), deps(db))).acao, 'ignorado')
  db = fakeDb({ links, groups: [{ id: 'm', userId: 'u1', waJid: 'tg:-1', role: 'monitor' }] })
  assert.equal((await handleLinkUpdate(startIn({ id: -1, type: 'group' }), deps(db))).acao, 'ja_e_origem')
  assert.equal(db.state.created.length, 0)
})

test('grupo que virou supergrupo acompanha o novo identificador', async () => {
  const db = fakeDb()
  const r = await handleLinkUpdate({ message: { chat: { id: -1, type: 'group' }, migrate_to_chat_id: -100999 } }, deps(db))
  assert.equal(r.acao, 'migrado')
  assert.deepEqual(db.state.migrated, ['-1', '-100999'])
})
