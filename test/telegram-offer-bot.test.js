import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTelegramOffer,
  buildTelegramOfferText,
  fetchTelegramOfferImage,
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
  assert.match(text, /~De R\$ 499~/)
  assert.match(text, /💥 \*Por R\$ 398\*/)
  assert.match(text, /🛒 Compre aqui 👉 https:\/\/afiliado\.test\/produto\?tag=minha-tag/)
  assert.doesNotMatch(text, /Achadinho do dia/)
})

test('fetchTelegramOfferImage baixa e normaliza imagem para link de marketplace suportado', async () => {
  const inputUrl = 'https://www.amazon.com.br/dp/B0ABC12345?tag=minha-tag'
  const rawBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00])
  const normalizedBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x01])
  const calls = []

  const image = await fetchTelegramOfferImage(inputUrl, {
    fetchProductImage: async (platform, url, credentials) => {
      calls.push(['fetchProductImage', platform, url, credentials])
      return 'https://m.media-amazon.com/images/I/produto.jpg'
    },
    fetchImageBuffer: async (imageUrl, refererUrl) => {
      calls.push(['fetchImageBuffer', imageUrl, refererUrl])
      return { buffer: rawBuffer, mimetype: 'image/webp' }
    },
    normalizeImage: async (buffer) => {
      calls.push(['normalizeImage', buffer])
      return { buffer: normalizedBuffer, mimetype: 'image/jpeg' }
    },
  })

  assert.equal(image.buffer, normalizedBuffer)
  assert.equal(image.mimetype, 'image/jpeg')
  assert.deepEqual(calls[0], ['fetchProductImage', 'amazon', inputUrl, {}])
  assert.deepEqual(calls[1], ['fetchImageBuffer', 'https://m.media-amazon.com/images/I/produto.jpg', inputUrl])
  assert.equal(calls[2][0], 'normalizeImage')
})

test('buildTelegramOffer retorna texto e imagem sem converter o link', async () => {
  const pastedUrl = 'https://www.amazon.com.br/dp/B0ABC12345?tag=minha-tag'
  const imageBuffer = Buffer.from([1, 2, 3])

  const offer = await buildTelegramOffer(pastedUrl, {
    fetchProductInfo: async (url) => {
      assert.equal(url, pastedUrl)
      return { title: 'Fone bluetooth', newPrice: 'R$ 89,90' }
    },
    fetchProductImage: async (platform, url) => {
      assert.equal(platform, 'amazon')
      assert.equal(url, pastedUrl)
      return 'https://m.media-amazon.com/images/I/fone.jpg'
    },
    fetchImageBuffer: async (imageUrl, refererUrl) => {
      assert.equal(imageUrl, 'https://m.media-amazon.com/images/I/fone.jpg')
      assert.equal(refererUrl, pastedUrl)
      return { buffer: imageBuffer, mimetype: 'image/jpeg' }
    },
    normalizeImage: async (buffer) => ({ buffer, mimetype: 'image/jpeg' }),
  })

  assert.match(offer.text, /🛍️ Fone bluetooth/)
  assert.match(offer.text, /🛒 Compre aqui 👉 https:\/\/www\.amazon\.com\.br\/dp\/B0ABC12345\?tag=minha-tag/)
  assert.equal(offer.image.buffer, imageBuffer)
  assert.equal(offer.image.mimetype, 'image/jpeg')
})

test('buildTelegramOfferText avisa quando scraper não retorna título nem preço', async () => {
  const text = await buildTelegramOfferText('https://www.mercadolivre.com.br/02-forma-silicone-retangular-reutilizavel-air-fryer-limpo-forma-de-cozimento-em-silicone-ideal-para-fritadeiras/p/MLB69573479', {
    fetchProductInfo: async () => ({ title: '', oldPrice: '', newPrice: '' }),
  })

  assert.equal(text, '⚠️ Nenhum produto encontrado para o link enviado!')
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
  assert.match(sent[0].text, /💥 \*Por R\$ 129,90\*/)
  assert.match(sent[0].text, /🛒 Compre aqui 👉 https:\/\/afiliado\.test\/tenis\?tag=abc/)
  assert.doesNotMatch(sent[0].text, /redirect=ignored/)
})

test('createTelegramOfferBot envia foto com a oferta quando imagem está disponível', async () => {
  const sent = []
  const imageBuffer = Buffer.from([9, 8, 7])
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => ({ title: 'Echo Pop', newPrice: 'R$ 199' }),
    fetchProductImage: async () => 'https://m.media-amazon.com/images/I/echo.jpg',
    fetchImageBuffer: async () => ({ buffer: imageBuffer, mimetype: 'image/jpeg' }),
    normalizeImage: async (buffer) => ({ buffer, mimetype: 'image/jpeg' }),
    telegramClient: {
      async sendMessage(chatId, text) {
        sent.push({ type: 'message', chatId, text })
      },
      async sendPhoto(chatId, image, extra) {
        sent.push({ type: 'photo', chatId, image, extra })
      },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'gera https://www.amazon.com.br/dp/B0ABC12345?tag=abc' } })

  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, 'photo')
  assert.equal(sent[0].chatId, 42)
  assert.equal(sent[0].image.buffer, imageBuffer)
  assert.equal(sent[0].image.mimetype, 'image/jpeg')
  assert.match(sent[0].extra.caption, /🛍️ Echo Pop/)
  assert.match(sent[0].extra.caption, /🛒 Compre aqui 👉 https:\/\/www\.amazon\.com\.br\/dp\/B0ABC12345\?tag=abc/)
})

test('createTelegramOfferBot cai para texto quando envio da foto falha', async () => {
  const sent = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => ({ title: 'Echo Pop', newPrice: 'R$ 199' }),
    fetchProductImage: async () => 'https://m.media-amazon.com/images/I/echo.jpg',
    fetchImageBuffer: async () => ({ buffer: Buffer.from([1]), mimetype: 'image/jpeg' }),
    normalizeImage: async (buffer) => ({ buffer, mimetype: 'image/jpeg' }),
    logger: { warn() {} },
    telegramClient: {
      async sendMessage(chatId, text) {
        sent.push({ type: 'message', chatId, text })
      },
      async sendPhoto() {
        throw new Error('telegram photo failed')
      },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'gera https://www.amazon.com.br/dp/B0ABC12345?tag=abc' } })

  assert.equal(sent.length, 1)
  assert.equal(sent[0].type, 'message')
  assert.match(sent[0].text, /🛍️ Echo Pop/)
})
