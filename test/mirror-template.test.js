import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMirrorTemplate, extractCouponLine, extractTextPrice, resolveMirrorOfferFromLink } from '../src/core/mirrorTemplate.js'

const COUPON_LINE_CASES = [
  ['- Resgate o cupom: VANTAGEMJA', '- Resgate o cupom: VANTAGEMJA'],
  ['⚠️ cupom: QUEIMADE', '⚠️ cupom: QUEIMADE'],
  ['🎟️ CUPOM: PEGUEISEU', '🎟️ CUPOM: PEGUEISEU'],
  ['Use o Cupom: TECNO200 🎟️', 'Use o Cupom: TECNO200 🎟️'],
  ['Use o Cupom: PROMOCERTA 🎟️', 'Use o Cupom: PROMOCERTA 🎟️'],
  ['🎟️ CUPOM: GARIMPEI ou ECONOMIAML', '🎟️ CUPOM: GARIMPEI ou ECONOMIAML'],
  ['🎟️ Use o cupom 3SP3C14L99 para R$10 OFF!', '🎟️ Use o cupom 3SP3C14L99 para R$10 OFF!'],
  ['✅Por: 180,70 c/cupom 🆘\n\n🎟️Use o cupom R$20,00 OFF CLUBE DO BEBÊ cadastre e resgate aqui:', '🎟️Use o cupom R$20,00 OFF CLUBE DO BEBÊ cadastre e resgate aqui:'],
  ['🎟️Use o cupom: 3SP3C14L99', '🎟️Use o cupom: 3SP3C14L99'],
  ['- Adicione o cupom de 25% OFF em "Itens para Casa" no anúncio', '- Adicione o cupom de 25% OFF em "Itens para Casa" no anúncio'],
]

test('extractCouponLine isola a linha completa de cupom nos formatos reais', () => {
  for (const [source, expected] of COUPON_LINE_CASES) {
    assert.equal(extractCouponLine(`Título da oferta\n${source}\nhttps://loja.test/produto`), expected)
  }
  assert.equal(extractCouponLine('Produto sem promoção\nhttps://loja.test/produto'), '')
})

const TEXT_PRICE_CASES = [
  ['💵 De R$ 1.890 por R$ 1.458,26\n- Resgate o cupom: VANTAGEMJA', '💵 De R$ 1.890 por R$ 1.458,26'],
  ['De: 159 | Por: R$47 👑\n⚠️ cupom: QUEIMADE', 'De: 159 | Por: R$47 👑'],
  ['🔥 DE 599 | POR 269,53 no Pix\n🎟️ CUPOM: PEGUEISEU', '🔥 DE 599 | POR 269,53 no Pix'],
  ['De R$ 999 por R$ 499 em 7x\nUse o Cupom: TECNO200 🎟️', 'De R$ 999 por R$ 499 em 7x'],
  ['De R$ 212 por R$ 112\nUse o Cupom: PROMOCERTA 🎟️', 'De R$ 212 por R$ 112'],
  ['🔥DE 111 l POR 55,23\n🎟️ CUPOM: GARIMPEI ou ECONOMIAML', '🔥DE 111 l POR 55,23'],
  ['De:149,91\nPor: 69,45 ✅\n\n🎟️ Use o cupom 3SP3C14L99 para R$10 OFF!', 'De:149,91\nPor: 69,45 ✅'],
  ['❌De:223,00\n✅Por: 180,70 c/cupom 🆘\n\n🎟️Use o cupom R$20,00 OFF CLUBE DO BEBÊ cadastre e resgate aqui:', '❌De:223,00\n✅Por: 180,70 c/cupom 🆘'],
  ['❌ De: R$ 112,99\n💸Por: R$ 102,99 😍\n\n🎟️Use o cupom: 3SP3C14L99', '❌ De: R$ 112,99\n💸Por: R$ 102,99 😍'],
]

test('extractTextPrice isola o preço editorial nos nove formatos reais com cupom', () => {
  for (const [source, expected] of TEXT_PRICE_CASES) {
    assert.equal(extractTextPrice(`Produto\n${source}\nhttps://loja.test/produto`), expected)
  }
  assert.equal(extractTextPrice('De R$ 100 por R$ 80\nOferta sem cupom'), 'De R$ 100 por R$ 80')
})

test('resolveMirrorOfferFromLink lê o link ORIGINAL do produto e emite o link convertido', async () => {
  const scraped = []
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/sec/abc123',
    platform: 'amazon',
    credentialsMap: { amazon: { tag: 'afiliado' }, mercadolivre: { ssid: 'x' } },
    fetchInfo: async (url, opts) => {
      scraped.push({ url, opts })
      return { title: 'Título do produto', oldPrice: 'R$ 199,90', newPrice: 'R$ 99,90', finalUrl: 'https://loja.test/produto-canonico' }
    },
  })

  // Raspa o ORIGINAL (alvo confiável), não o convertido /sec/ de vitrine.
  assert.equal(scraped.length, 1)
  assert.equal(scraped[0].url, 'https://loja.test/produto')
  // Credenciais do ML repassadas ao scraper para evitar anti-bot.
  assert.equal(scraped[0].opts.mlCredentials.ssid, 'x')
  assert.deepEqual(fields, {
    title: 'Título do produto',
    oldPrice: 'R$ 199,90',
    price: 'R$ 99,90',
    // O link emitido é SEMPRE o convertido (afiliado), nunca o finalUrl canônico.
    link: 'https://loja.test/sec/abc123',
    storeName: 'Amazon',
  })
})

// specs/012-shein-store-support (C3/T042): rótulo da loja no template do
// espelhamento.
test('resolveMirrorOfferFromLink rotula shein como SHEIN', async () => {
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://br.shein.com/vestido-p-485735309.html',
    convertedUrl: 'https://m.shein.com/br/ark/default?goods_id=485735309&koc_id=123',
    platform: 'shein',
    fetchInfo: async () => ({ title: 'Título do produto', oldPrice: '', newPrice: 'R$ 49,90' }),
  })
  assert.equal(fields.storeName, 'SHEIN')
})

test('resolveMirrorOfferFromLink usa o convertido como último recurso quando o original não traz nada', async () => {
  const scraped = []
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/original',
    convertedUrl: 'https://loja.test/convertido',
    platform: 'mercadolivre',
    fetchInfo: async (url) => {
      scraped.push(url)
      if (url === 'https://loja.test/original') return { title: '', oldPrice: '', newPrice: '' }
      return { title: 'Produto real', oldPrice: '', newPrice: 'R$ 50,00' }
    },
  })

  assert.deepEqual(scraped, ['https://loja.test/original', 'https://loja.test/convertido'])
  assert.equal(fields.title, 'Produto real')
  assert.equal(fields.price, 'R$ 50,00')
  assert.equal(fields.link, 'https://loja.test/convertido')
})

test('resolveMirrorOfferFromLink NUNCA emite o link do terceiro: sem convertido, devolve null', async () => {
  // No espelhamento o originalUrl é o link de OUTRO afiliado. Sem link
  // convertido do nosso cliente, não pode sair oferta (evita vazar comissão).
  const fields = await resolveMirrorOfferFromLink({
    originalUrl: 'https://loja.test/terceiro?tag=concorrente',
    convertedUrl: '',
    platform: 'amazon',
    fetchInfo: async () => ({ title: 'Produto', oldPrice: '', newPrice: 'R$ 10,00' }),
  })
  assert.equal(fields, null)
})

test('applyMirrorTemplate renderiza com título/preço vindos do scraper, não do texto espelhado', async () => {
  const text = await applyMirrorTemplate('🔥 Oferta imperdível\nCaption upstream errado\nR$ 1,00\nhttps://loja.test/produto', {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n💰 {preço}\n👉 {link}' }] }) },
    fetchInfo: async () => ({ title: 'Título real do link', oldPrice: '', newPrice: 'R$ 99,90' }),
  })

  assert.equal(text, '🔥 Título real do link\n💰 R$ 99,90\n👉 https://loja.test/produto?tag=afiliado')
  assert.doesNotMatch(text, /Caption upstream errado|R\$ 1,00/)
})

test('applyMirrorTemplate injeta a linha de cupom da mensagem de origem quando o template pede', async () => {
  const text = await applyMirrorTemplate([
    'Oferta upstream',
    '🎟️ CUPOM: GARIMPEI ou ECONOMIAML',
    'https://loja.test/produto',
  ].join('\n'), {
    templateKey: 'tpl_cupom',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_cupom', name: 'Cupom', body: '{produto}\n{linhaDeCupom}\n{link}' }] }) },
    fetchInfo: async () => ({ title: 'Produto real', oldPrice: '', newPrice: 'R$ 55,23' }),
  })

  assert.equal(text, 'Produto real\n🎟️ CUPOM: GARIMPEI ou ECONOMIAML\nhttps://loja.test/produto?tag=afiliado')
})

test('applyMirrorTemplate injeta preçoDoTexto junto da linha de cupom quando o template pede', async () => {
  const text = await applyMirrorTemplate([
    'Oferta upstream',
    '❌De:223,00',
    '✅Por: 180,70 c/cupom 🆘',
    '',
    '🎟️Use o cupom R$20,00 OFF CLUBE DO BEBÊ cadastre e resgate aqui:',
    'https://loja.test/produto',
  ].join('\n'), {
    templateKey: 'tpl_preco_texto',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_preco_texto', name: 'Preço do texto', body: '{produto}\n{preçoDoTexto}\n{linhaDeCupom}\n{link}' }] }) },
    fetchInfo: async () => ({ title: 'Produto real', oldPrice: 'R$ 223,00', newPrice: 'R$ 199,00' }),
  })

  assert.equal(text, [
    'Produto real',
    '❌De:223,00',
    '✅Por: 180,70 c/cupom 🆘',
    '🎟️Use o cupom R$20,00 OFF CLUBE DO BEBÊ cadastre e resgate aqui:',
    'https://loja.test/produto?tag=afiliado',
  ].join('\n'))
  assert.doesNotMatch(text, /R\$ 199,00/)
})

test('applyMirrorTemplate usa preço da loja em preçoDoTexto quando a copy não traz preço editorial', async () => {
  const text = await applyMirrorTemplate('Oferta sem linha de preço\n🎟️ CUPOM: LOJA10\nhttps://loja.test/produto', {
    templateKey: 'tpl_preco_fallback',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_preco_fallback', name: 'Preço fallback', body: '{produto}\n{preçoDoTexto}\n{linhaDeCupom}\n{link}' }] }) },
    fetchInfo: async () => ({ title: 'Produto real', oldPrice: 'R$ 129,90', newPrice: 'R$ 89,90' }),
  })

  assert.equal(text, 'Produto real\nR$ 89,90\n🎟️ CUPOM: LOJA10\nhttps://loja.test/produto?tag=afiliado')
})

test('applyMirrorTemplate usa preço da loja em preçoDoTexto mesmo quando a mensagem não tem cupom', async () => {
  const text = await applyMirrorTemplate('Oferta sem cupom nem preço\nhttps://loja.test/produto', {
    templateKey: 'tpl_preco_fallback_sem_cupom',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_preco_fallback_sem_cupom', name: 'Preço fallback', body: '{produto}\n{preçoDoTexto}\n{link}' }] }) },
    fetchInfo: async () => ({ title: 'Produto real', oldPrice: '', newPrice: 'R$ 79,90' }),
  })

  assert.equal(text, 'Produto real\nR$ 79,90\nhttps://loja.test/produto?tag=afiliado')
})

test('applyMirrorTemplate preserva preço e instrução de adicionar cupom percentual', async () => {
  const text = await applyMirrorTemplate([
    'CORRE QUE CAIU O PREÇO',
    '',
    '📹 TP-Link Tapo C100 Câmera de Segurança Wifi 1080P Full HD',
    '💵 De R$169,90 por R$113,36 no pix',
    '- Adicione o cupom de 25% OFF em "Itens para Casa" no anúncio',
    '',
    'https://meli.la/1Z6Ceo9',
  ].join('\n'), {
    templateKey: 'tpl_cupom_percentual',
    originalUrl: 'https://meli.la/1Z6Ceo9',
    convertedUrl: 'https://meli.la/21xyU8m',
    platform: 'mercadolivre',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{
      key: 'tpl_cupom_percentual',
      name: 'Cupom percentual',
      body: '🛒️ {produto}\n\n💰 {preçoDoTexto}\n\n*{linhaDeCupom}*\n\n🔗 Link: {link}',
    }] }) },
    fetchInfo: async () => ({
      title: 'TP-Link Tapo C100 Câmera de Segurança Wifi 1080P Full HD',
      oldPrice: 'R$ 169,90',
      newPrice: '131,36',
    }),
  })

  assert.equal(text, [
    '🛒️ TP-Link Tapo C100 Câmera de Segurança Wifi 1080P Full HD',
    '',
    '💰 💵 De R$169,90 por R$113,36 no pix',
    '',
    '*- Adicione o cupom de 25% OFF em "Itens para Casa" no anúncio*',
    '',
    '🔗 Link: https://meli.la/21xyU8m',
  ].join('\n'))
  assert.doesNotMatch(text, /131,36/)
})

test('applyMirrorTemplate preserva linha De/Por completa mesmo sem cupom', async () => {
  const text = await applyMirrorTemplate([
    '> 🧡 Impressora 3d Bambu Lab A1 Prateado',
    '',
    '📴 Com desconto de até 14%',
    '',
    'De: R$ 3529,00 | 🛒 Por: R$ 3039,00🤩',
    '',
    '💳 Parcelinha que cabe no bolso 10x de R$ 319,90 sem juros',
    '',
    '🔗 COMPRE AQUI:',
    'https://meli.la/1MbLwQx',
  ].join('\n'), {
    templateKey: 'automatico_classico',
    originalUrl: 'https://meli.la/1MbLwQx',
    convertedUrl: 'https://www.mercadolivre.com.br/p/MLB53283626?partner_id=475630078',
    platform: 'mercadolivre',
    botConfig: { mobileTemplatesJson: JSON.stringify({ overrides: {
      automatico_classico: '🏷️ {produto}\n\n💰 {preçoDoTexto}\n\n👉 {link}',
    } }) },
    fetchInfo: async () => ({
      title: 'Impressora 3d Bambu Lab A1 Prateado',
      oldPrice: 'R$ 3529,00',
      newPrice: '3039,00',
    }),
  })

  assert.equal(text, [
    '🏷️ Impressora 3d Bambu Lab A1 Prateado',
    '',
    '💰 De: R$ 3529,00 | 🛒 Por: R$ 3039,00🤩',
    '',
    '👉 https://www.mercadolivre.com.br/p/MLB53283626?partner_id=475630078',
  ].join('\n'))
  assert.doesNotMatch(text, /^\ud83d\udcb0 3039,00$/m)
  assert.doesNotMatch(text, /319,90/)
})

test('applyMirrorTemplate remove linhaDeCupom sem deixar placeholder quando a origem não tem cupom', async () => {
  const text = await applyMirrorTemplate('Oferta sem cupom informado\nhttps://loja.test/produto', {
    templateKey: 'tpl_cupom',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_cupom', name: 'Cupom', body: '{produto}\n{linhaDeCupom}\n{link}' }] }) },
    fetchInfo: async () => ({ title: 'Produto real', oldPrice: '', newPrice: 'R$ 55,23' }),
  })

  assert.equal(text, 'Produto real\nhttps://loja.test/produto?tag=afiliado')
})

test('applyMirrorTemplate não leva a copy de cupom para template que não pediu a variável', async () => {
  const text = await applyMirrorTemplate('🎟️ CUPOM: NAODEVEENTRAR\nhttps://loja.test/produto', {
    templateKey: 'tpl_sem_cupom',
    originalUrl: 'https://loja.test/produto',
    convertedUrl: 'https://loja.test/produto?tag=afiliado',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_sem_cupom', name: 'Sem cupom', body: '{produto}\n{link}' }] }) },
    fetchInfo: async () => ({ title: 'Produto real', oldPrice: '', newPrice: 'R$ 55,23' }),
  })

  assert.equal(text, 'Produto real\nhttps://loja.test/produto?tag=afiliado')
  assert.doesNotMatch(text, /NAODEVEENTRAR/)
})

test('applyMirrorTemplate substitui grupoLink e cupomLink apenas quando o template contém as variáveis', async () => {
  const text = await applyMirrorTemplate('Texto original https://ex.com/a', {
    templateKey: 'tpl_links',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: {
      mobileTemplatesJson: JSON.stringify({
        custom: [{
          key: 'tpl_links',
          name: 'Links globais',
          body: '🔥 {produto}\n👉 {link}\nGrupo: {{grupoLink}}\nCupom: {{cupomLink}}',
        }],
      }),
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      couponLink: 'https://cupom.test/oferta',
    },
    fetchInfo: async () => ({ title: 'Produto com links', oldPrice: '', newPrice: 'R$ 99,90' }),
  })

  assert.equal(text, [
    '🔥 Produto com links',
    '👉 https://ex.com/a?tag=ok',
    'Grupo: https://chat.whatsapp.com/grupo',
    'Cupom: https://cupom.test/oferta',
  ].join('\n'))
})

test('applyMirrorTemplate não injeta grupoLink nem cupomLink quando o template não contém as variáveis', async () => {
  const text = await applyMirrorTemplate('Texto original https://ex.com/a', {
    templateKey: 'tpl_sem_links_globais',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: {
      mobileTemplatesJson: JSON.stringify({
        custom: [{
          key: 'tpl_sem_links_globais',
          name: 'Sem links globais',
          body: '🔥 {produto}\n👉 {link}',
        }],
      }),
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      couponLink: 'https://cupom.test/oferta',
    },
    fetchInfo: async () => ({ title: 'Produto sem links globais', oldPrice: '', newPrice: 'R$ 49,90' }),
  })

  assert.equal(text, '🔥 Produto sem links globais\n👉 https://ex.com/a?tag=ok')
  assert.doesNotMatch(text, /chat\.whatsapp\.com\/grupo/)
  assert.doesNotMatch(text, /cupom\.test\/oferta/)
})

test('applyMirrorTemplate preserva texto original quando não há template válido ou link', async () => {
  assert.equal(await applyMirrorTemplate('original', { templateKey: 'missing', botConfig: {} }), 'original')
  assert.equal(await applyMirrorTemplate('Só um aviso sem link', {
    templateKey: 'tpl_mirror',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n👉 {link}' }] }) },
  }), 'Só um aviso sem link')
})

test('applyMirrorTemplate não vaza placeholders vazios nem injeta branding quando variável não existe no template', async () => {
  const text = await applyMirrorTemplate('Texto upstream sem preço\nhttps://ex.com/a', {
    templateKey: 'simples',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: {
      mobileTemplatesJson: '{}',
      brandingGroupLink: 'https://chat.whatsapp.com/grupo',
      brandingCtaText: 'Entre no grupo VIP:',
    },
    fetchInfo: async () => ({ title: 'Fone Bluetooth XPTO', oldPrice: '', newPrice: '' }),
  })
  assert.doesNotMatch(text, /\{(?:preço|preço_de|desconto|rating|vendas)\}/)
  assert.match(text, /Fone Bluetooth XPTO/)
  assert.match(text, /https:\/\/ex\.com\/a\?tag=ok/)
  assert.doesNotMatch(text, /Entre no grupo VIP:/)
  assert.doesNotMatch(text, /https:\/\/chat\.whatsapp\.com\/grupo/)
})

test('applyMirrorTemplate preserva texto original quando o scraper lança erro inesperado', async () => {
  const warnings = []
  const original = 'Oferta original https://ex.com/a?tag=ok'
  const text = await applyMirrorTemplate(original, {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '{produto}\n{link}' }] }) },
    fetchInfo: async () => { throw new Error('scraper indisponível') },
    logger: { warn: (payload, message) => warnings.push({ payload, message }) },
  })
  // Erro em ambos os candidatos => sem info útil => cai no relay (sem título/preço).
  assert.equal(text, original)
  assert.ok(warnings.length >= 1)
})

test('applyMirrorTemplate cai no relay quando o scrape não traz título nem preço', async () => {
  const original = 'Promo boa demais\nhttps://ex.com/a'
  const text = await applyMirrorTemplate(original, {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '🔥 {produto}\n💰 {preço}\n👉 {link}' }] }) },
    fetchInfo: async () => ({ title: '', oldPrice: '', newPrice: '' }),
  })
  assert.equal(text, original)
})

test('applyMirrorTemplate cai no relay quando o scrape estoura o orçamento de tempo', async () => {
  const warnings = []
  const original = 'Oferta original https://ex.com/a?tag=ok'
  const text = await applyMirrorTemplate(original, {
    templateKey: 'tpl_mirror',
    originalUrl: 'https://ex.com/a',
    convertedUrl: 'https://ex.com/a?tag=ok',
    platform: 'amazon',
    scrapeBudgetMs: 20,
    botConfig: { mobileTemplatesJson: JSON.stringify({ custom: [{ key: 'tpl_mirror', name: 'Mirror', body: '{produto}\n{link}' }] }) },
    fetchInfo: () => new Promise(() => {}), // nunca resolve — simula loja lenta
    logger: { warn: (payload, message) => warnings.push({ payload, message }) },
  })
  assert.equal(text, original)
  assert.equal(warnings.length, 1)
})
