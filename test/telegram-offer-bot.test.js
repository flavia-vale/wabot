import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTelegramOfferText,
  createTelegramOfferBot,
  extractSingleHttpUrl,
} from '../src/telegram/offerBot.js'

test('extractSingleHttpUrl exige exatamente um link http(s)', () => {
  assert.equal(extractSingleHttpUrl('olha https://loja.test/produto?x=1').url, 'https://loja.test/produto?x=1')
  assert.equal(extractSingleHttpUrl('sem link').code, 'NO_LINK')
  assert.equal(extractSingleHttpUrl('https://a.test/1 https://b.test/2').code, 'MULTIPLE_LINKS')
  assert.equal(extractSingleHttpUrl('ftp://loja.test/produto').code, 'NO_LINK')
})

test('buildTelegramOfferText monta oferta usando o link original sem converter', async () => {
  const pastedUrl = 'https://afiliado.test/produto?tag=minha-tag'
  const text = await buildTelegramOfferText(pastedUrl, {
    fetchProductInfo: async (url) => {
      assert.equal(url, pastedUrl)
      return { title: 'Cafeteira inox', oldPrice: 'R$ 499', newPrice: 'R$ 398' }
    },
  })

  assert.match(text, /🛍️ Cafeteira inox/)
  assert.match(text, /De R\$ 499/)
  assert.match(text, /💥 Por \*R\$ 398\*/)
  assert.match(text, /🛒 Compre aqui 👉 https:\/\/afiliado\.test\/produto\?tag=minha-tag/)
  assert.doesNotMatch(text, /Achadinho do dia/)
})

test('createTelegramOfferBot responde mensagens com oferta e não chama conversor', async () => {
  const sent = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async (url) => ({ title: 'Tênis leve', newPrice: 'R$ 129,90', finalUrl: `${url}&redirect=ignored` }),
    telegramClient: {
      async sendMessage(chatId, text) {
        sent.push({ chatId, text })
      },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'gera https://afiliado.test/tenis?tag=abc' } })

  assert.equal(sent.length, 1)
  assert.equal(sent[0].chatId, 42)
  assert.match(sent[0].text, /🛍️ Tênis leve/)
  assert.match(sent[0].text, /💥 Por \*R\$ 129,90\*/)
  assert.match(sent[0].text, /🛒 Compre aqui 👉 https:\/\/afiliado\.test\/tenis\?tag=abc/)
  assert.doesNotMatch(sent[0].text, /redirect=ignored/)
})
