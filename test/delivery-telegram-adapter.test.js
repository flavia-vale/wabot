import test from 'node:test'
import assert from 'node:assert/strict'
import { TelegramApiError } from '../src/delivery/telegram/api.js'
import {
  TELEGRAM_REASON,
  chatIdOf,
  classifyTelegramError,
  createTelegramAdapter,
  isOwnDestination,
  readinessFromMember,
  toDestinationId,
} from '../src/delivery/telegram/adapter.js'
import { whatsappTextToTelegramHtml, clampText } from '../src/delivery/telegram/format.js'
import { DELIVERY_FAILURE_REASONS } from '../src/core/delivery/deliveryFailure.js'

// Feature 017, Fatia 3 (T043/T044): o adaptador do Telegram reconhece o
// próprio formato, explica cada recusa com um motivo do catálogo e nunca
// lança para quem chama (contrato, regra 2).

const err = (errorCode, description, extra = {}) => new TelegramApiError('sendMessage', { status: errorCode, errorCode, description, ...extra })

test('identificador próprio: tg:<id>', () => {
  assert.equal(toDestinationId(-100123), 'tg:-100123')
  assert.equal(chatIdOf('tg:-100123'), '-100123')
  assert.equal(isOwnDestination('120363@g.us'), false)
  assert.equal(chatIdOf('120363@g.us'), null)
})

test('cada recusa vira um motivo do catálogo com texto', () => {
  const cases = [
    [err(429, 'Too Many Requests', { retryAfterSec: 7 }), TELEGRAM_REASON.LIMITE_DE_RITMO, true],
    [err(403, 'Forbidden: bot was kicked from the supergroup chat'), TELEGRAM_REASON.ROBO_NAO_ADICIONADO, false],
    [err(400, 'Bad Request: chat not found'), TELEGRAM_REASON.DESTINO_APAGADO, false],
    [err(400, 'Bad Request: not enough rights to send text messages to the chat'), TELEGRAM_REASON.SEM_PERMISSAO, false],
    [err(502, 'Bad Gateway'), TELEGRAM_REASON.ROBO_INDISPONIVEL, true],
    [err(401, 'Unauthorized'), TELEGRAM_REASON.ROBO_INDISPONIVEL, true],
    [err(400, 'Bad Request: wrong file identifier'), TELEGRAM_REASON.OFERTA_INCOMPATIVEL, false],
  ]
  for (const [e, motivo, temporario] of cases) {
    const c = classifyTelegramError(e)
    assert.equal(c.motivo, motivo, e.description)
    assert.equal(c.temporario, temporario, e.description)
    assert.ok(DELIVERY_FAILURE_REASONS.telegram[c.motivo]?.texto, `${c.motivo} sem texto`)
  }
  assert.equal(classifyTelegramError(err(429, 'x', { retryAfterSec: 7 })).retryAfterSec, 7)
  assert.equal(classifyTelegramError(err(401, 'Unauthorized')).sinal, 'bloqueado')
  assert.equal(classifyTelegramError(err(403, 'kicked')).sinal, undefined, 'recusa de um grupo não diz nada sobre o robô')
})

test('três estados de prontidão do robô no grupo', () => {
  assert.equal(readinessFromMember({ status: 'left' }).motivo, TELEGRAM_REASON.ROBO_NAO_ADICIONADO)
  assert.equal(readinessFromMember({ status: 'kicked' }).motivo, TELEGRAM_REASON.ROBO_NAO_ADICIONADO)
  assert.equal(readinessFromMember({ status: 'restricted', can_send_messages: false }).motivo, TELEGRAM_REASON.SEM_PERMISSAO)
  assert.equal(readinessFromMember({ status: 'administrator', can_post_messages: false }).motivo, TELEGRAM_REASON.SEM_PERMISSAO)
  assert.equal(readinessFromMember({ status: 'administrator' }).pronto, true)
  assert.equal(readinessFromMember({ status: 'member' }).pronto, true)
})

test('formatação do WhatsApp vira HTML do Telegram, com escape', () => {
  assert.equal(whatsappTextToTelegramHtml('*Oferta* de _hoje_ <3 & ~velho~'), '<b>Oferta</b> de <i>hoje</i> &lt;3 &amp; <s>velho</s>')
  assert.equal(whatsappTextToTelegramHtml('preço 2*3 = 6'), 'preço 2*3 = 6')
  assert.ok(clampText('a'.repeat(5000), 4096).length <= 4096)
})

function fakeApi(overrides = {}) {
  const calls = []
  return {
    calls,
    getMe: async () => ({ id: 999, username: 'EspelhaGruposBot' }),
    getChatMember: async () => ({ status: 'administrator' }),
    sendMessage: async (chatId, text, extra) => { calls.push({ m: 'sendMessage', chatId, text, extra }); return { message_id: 1 } },
    sendPhoto: async (chatId, url, caption, extra) => { calls.push({ m: 'sendPhoto', chatId, url, caption, extra }); return { message_id: 2 } },
    ...overrides,
  }
}

test('envia foto com legenda quando cabe; texto com o link quando não está no texto', async () => {
  const api = fakeApi()
  const adapter = createTelegramAdapter({ api, db: null })
  const r = await adapter.send({ texto: '*Fone* por R$ 10', linkConvertido: 'https://s.shopee.com.br/x', imagem: { url: 'https://img/x.jpg' } }, 'tg:-1001')
  assert.deepEqual(r, { ok: true, messageId: '2', reducoes: [] })
  assert.equal(api.calls[0].m, 'sendPhoto')
  assert.match(api.calls[0].caption, /<b>Fone<\/b> por R\$ 10\n\nhttps:\/\/s\.shopee\.com\.br\/x/)
})

test('marcação recusada: reenvia em texto puro', async () => {
  let first = true
  const api = fakeApi({
    sendMessage: async (chatId, text, extra) => {
      if (first) { first = false; throw err(400, "Bad Request: can't parse entities") }
      return { message_id: 5, text, extra }
    },
  })
  const adapter = createTelegramAdapter({ api, db: null })
  const r = await adapter.send({ texto: '*x' }, 'tg:-1')
  assert.equal(r.ok, true)
})

test('grupo que virou supergrupo: acompanha o novo identificador e entrega', async () => {
  const updates = []
  const db = {
    group: {
      findMany: async ({ where }) => (where.waJid === 'tg:-1' ? [{ id: 'g1' }] : []),
      update: async (args) => { updates.push(args); return {} },
    },
  }
  const api = fakeApi({
    sendMessage: async (chatId) => {
      if (chatId === '-1') throw err(400, 'Bad Request: group chat was upgraded to a supergroup chat', { migrateToChatId: -100777 })
      return { message_id: 9 }
    },
  })
  const adapter = createTelegramAdapter({ api, db })
  const r = await adapter.send({ texto: 'oi' }, 'tg:-1')
  assert.equal(r.ok, true)
  assert.deepEqual(updates, [{ where: { id: 'g1' }, data: { waJid: 'tg:-100777' } }])
})

test('send nunca lança: falha vira { ok: false, motivo }', async () => {
  const api = fakeApi({ sendMessage: async () => { throw err(403, 'Forbidden: bot was kicked') } })
  const adapter = createTelegramAdapter({ api, db: null })
  const r = await adapter.send({ texto: 'oi' }, 'tg:-1')
  assert.equal(r.ok, false)
  assert.equal(r.motivo, TELEGRAM_REASON.ROBO_NAO_ADICIONADO)
  assert.deepEqual(await adapter.send({ texto: 'oi' }, '123@g.us'), { ok: false, motivo: TELEGRAM_REASON.DESTINO_APAGADO, temporario: false })
})
