import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildTelegramOffer,
  buildTelegramOfferText,
  fetchTelegramOfferImage,
  createTelegramOfferBot,
  extractSingleHttpUrl,
  buildWhatsappShareUrl,
  buildWhatsappShareMarkup,
  WHATSAPP_SHARE_PROMPT,
} from '../src/telegram/offerBot.js'


test('telegram offer bot PM2 e npm scripts usam runner explícito', () => {
  const ecosystem = readFileSync(new URL('../ecosystem.config.cjs', import.meta.url), 'utf8')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const runner = readFileSync(new URL('../src/telegram/offerBotRunner.js', import.meta.url), 'utf8')

  assert.match(ecosystem, /name: 'telegram-offer-bot'[\s\S]*script: 'src\/telegram\/offerBotRunner\.js'/)
  assert.match(ecosystem, /name: 'telegram-offer-bot-staging'[\s\S]*script: 'src\/telegram\/offerBotRunner\.js'/)
  assert.equal(pkg.scripts['telegram:offer-bot'], 'node src/telegram/offerBotRunner.js')
  assert.match(runner, /runner booting/)
  assert.match(runner, /tokenConfigured/)
  assert.match(runner, /import\('\.\/offerBot\.js'\)/)
  assert.match(runner, /createTelegramOfferBot\(\{[\s\S]*?recordOfferLog: recordTelegramOfferLog[\s\S]*?\}\)/)
  assert.match(runner, /await bot\.start\(\)/)
})

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

test('buildTelegramOfferText não envia placeholder {preço} quando scraper acha título mas não acha preço', async () => {
  const text = await buildTelegramOfferText('https://www.amazon.com.br/Cafeteira-Eletrica-Inox/dp/B09ABC123', {
    fetchProductInfo: async () => ({ title: 'Cafeteira Elétrica Inox', oldPrice: '', newPrice: '' }),
  })

  assert.doesNotMatch(text, /\{preço\}/)
  assert.doesNotMatch(text, /\{preço_de\}/)
  assert.doesNotMatch(text, /\{produto\}/)
  assert.doesNotMatch(text, /\{link\}/)
  assert.match(text, /Cafeteira Elétrica Inox/)
  assert.match(text, /https:\/\/www\.amazon\.com\.br\/Cafeteira-Eletrica-Inox\/dp\/B09ABC123/)
})

test('createTelegramOfferBot responde mensagens com oferta e não chama conversor', async () => {
  const sent = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async (url) => ({ title: 'Tênis leve', newPrice: 'R$ 129,90', finalUrl: `${url}&redirect=ignored` }),
    telegramClient: {
      async sendMessage(chatId, text, extra) {
        sent.push({ chatId, text, extra })
      },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'gera https://afiliado.test/tenis?tag=abc' } })

  assert.equal(sent.length, 2)
  assert.equal(sent[0].chatId, 42)
  assert.match(sent[0].text, /🛍️ Tênis leve/)
  assert.match(sent[0].text, /💥 \*Por R\$ 129,90\*/)
  assert.match(sent[0].text, /🛒 Compre aqui 👉 https:\/\/afiliado\.test\/tenis\?tag=abc/)
  assert.doesNotMatch(sent[0].text, /redirect=ignored/)

  // Segunda mensagem: convite + botão "Sim" que encaminha a oferta ao WhatsApp.
  assert.equal(sent[1].text, WHATSAPP_SHARE_PROMPT)
  const button = sent[1].extra.reply_markup.inline_keyboard[0][0]
  assert.equal(button.text, 'Sim')
  assert.equal(button.url, `https://wa.me/?text=${encodeURIComponent(sent[0].text)}`)
})

test('buildWhatsappShareUrl codifica a oferta exatamente como o link wa.me esperado', () => {
  const offerText = '🛍️ Sapato Babuche Feminino Macio em EVA com Enfeites Sortidos - Original\n\n~De R$ 100,00~\n💥 *Por R$ 40,91*'
  const url = buildWhatsappShareUrl(offerText)
  assert.ok(url.startsWith('https://wa.me/?text='))
  // Decodificar de volta deve reproduzir o texto original (round-trip seguro).
  assert.equal(decodeURIComponent(url.slice('https://wa.me/?text='.length)), offerText)
  // Formatação do WhatsApp preservada na codificação (emoji, ~, *, \n).
  assert.match(url, /%F0%9F%9B%8D%EF%B8%8F/) // 🛍️
  assert.match(url, /~De%20R%24%20100%2C00~/)
  // encodeURIComponent não codifica '*' (igual ao comportamento padrão do
  // JS); o WhatsApp recebe o '*' literal e renderiza negrito do mesmo jeito.
  assert.match(url, /\*Por%20R%24%2040%2C91\*/)
  assert.match(url, /%0A%0A/)
})

test('buildWhatsappShareMarkup monta inline_keyboard com botão Sim', () => {
  const markup = buildWhatsappShareMarkup('oferta x')
  assert.deepEqual(markup, {
    inline_keyboard: [[{ text: 'Sim', url: 'https://wa.me/?text=oferta%20x' }]],
  })
})

test('createTelegramOfferBot NÃO oferece botão de WhatsApp quando produto não é encontrado', async () => {
  const sent = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => ({ title: '', oldPrice: '', newPrice: '' }),
    fetchProductImage: async () => null,
    telegramClient: {
      async sendMessage(chatId, text, extra) {
        sent.push({ chatId, text, extra })
      },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'https://loja.test/produto' } })

  assert.equal(sent.length, 1)
  assert.equal(sent[0].text, '⚠️ Nenhum produto encontrado para o link enviado!')
  assert.equal(sent[0].extra, undefined)
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
      async sendMessage(chatId, text, extra) {
        sent.push({ type: 'message', chatId, text, extra })
      },
      async sendPhoto(chatId, image, extra) {
        sent.push({ type: 'photo', chatId, image, extra })
      },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'gera https://www.amazon.com.br/dp/B0ABC12345?tag=abc' } })

  assert.equal(sent.length, 2)
  assert.equal(sent[0].type, 'photo')
  assert.equal(sent[0].chatId, 42)
  assert.equal(sent[0].image.buffer, imageBuffer)
  assert.equal(sent[0].image.mimetype, 'image/jpeg')
  assert.match(sent[0].extra.caption, /🛍️ Echo Pop/)
  assert.match(sent[0].extra.caption, /🛒 Compre aqui 👉 https:\/\/www\.amazon\.com\.br\/dp\/B0ABC12345\?tag=abc/)

  // Após a foto, o convite com botão "Sim" para o WhatsApp.
  assert.equal(sent[1].type, 'message')
  assert.equal(sent[1].text, WHATSAPP_SHARE_PROMPT)
  assert.equal(sent[1].extra.reply_markup.inline_keyboard[0][0].text, 'Sim')
  assert.ok(sent[1].extra.reply_markup.inline_keyboard[0][0].url.startsWith('https://wa.me/?text='))
})

test('createTelegramOfferBot registra log de sucesso com plataforma, withImage e latência', async () => {
  const logs = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => ({ title: 'Echo Pop', newPrice: 'R$ 199' }),
    fetchProductImage: async () => 'https://m.media-amazon.com/images/I/echo.jpg',
    fetchImageBuffer: async () => ({ buffer: Buffer.from([1]), mimetype: 'image/jpeg' }),
    normalizeImage: async (buffer) => ({ buffer, mimetype: 'image/jpeg' }),
    recordOfferLog: async (entry) => { logs.push(entry) },
    telegramClient: {
      async sendMessage() {},
      async sendPhoto() {},
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'https://www.amazon.com.br/dp/B0ABC12345?tag=abc' } })

  assert.equal(logs.length, 1)
  assert.equal(logs[0].status, 'success')
  assert.equal(logs[0].platform, 'amazon')
  assert.equal(logs[0].withImage, true)
  assert.equal(logs[0].inputUrl, 'https://www.amazon.com.br/dp/B0ABC12345?tag=abc')
  assert.equal(typeof logs[0].latencyMs, 'number')
})

test('createTelegramOfferBot registra product_not_found quando scraper não acha produto', async () => {
  const logs = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => ({ title: '', newPrice: '' }),
    fetchProductImage: async () => null,
    recordOfferLog: async (entry) => { logs.push(entry) },
    telegramClient: { async sendMessage() {} },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'https://www.amazon.com.br/dp/B0XYZ' } })

  assert.equal(logs.length, 1)
  assert.equal(logs[0].status, 'product_not_found')
})

test('createTelegramOfferBot registra invalid_input quando não há link válido', async () => {
  const logs = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    recordOfferLog: async (entry) => { logs.push(entry) },
    telegramClient: { async sendMessage() {} },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'manda dois https://a.test/1 https://b.test/2' } })

  assert.equal(logs.length, 1)
  assert.equal(logs[0].status, 'invalid_input')
  assert.equal(logs[0].errorMsg, 'MULTIPLE_LINKS')
})

test('createTelegramOfferBot registra error quando geração lança', async () => {
  const logs = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => { throw new Error('scraper explodiu') },
    fetchProductImage: async () => null,
    logger: { warn() {} },
    recordOfferLog: async (entry) => { logs.push(entry) },
    telegramClient: { async sendMessage() {} },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'https://www.amazon.com.br/dp/B0ABC' } })

  assert.equal(logs.length, 1)
  assert.equal(logs[0].status, 'error')
  assert.match(logs[0].errorMsg, /scraper explodiu/)
})

test('createTelegramOfferBot não derruba atendimento se recordOfferLog falhar', async () => {
  const sent = []
  const bot = createTelegramOfferBot({
    token: '123:test',
    allowedChatIds: ['42'],
    fetchProductInfo: async () => ({ title: 'Tênis', newPrice: 'R$ 99' }),
    fetchProductImage: async () => null,
    logger: { warn() {} },
    recordOfferLog: async () => { throw new Error('db down') },
    telegramClient: {
      async sendMessage(chatId, text, extra) { sent.push({ chatId, text, extra }) },
    },
  })

  await bot.handleUpdate({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, text: 'https://afiliado.test/tenis' } })

  // Oferta + convite WhatsApp foram enviados mesmo com o log falhando.
  assert.equal(sent.length, 2)
  assert.match(sent[0].text, /🛍️ Tênis/)
  assert.equal(sent[1].text, WHATSAPP_SHARE_PROMPT)
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

  assert.equal(sent.length, 2)
  assert.equal(sent[0].type, 'message')
  assert.match(sent[0].text, /🛍️ Echo Pop/)
  // Mesmo no fallback de texto, o convite ao WhatsApp é enviado.
  assert.equal(sent[1].text, WHATSAPP_SHARE_PROMPT)
})
