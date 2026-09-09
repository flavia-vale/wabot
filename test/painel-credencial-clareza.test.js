// Guardas da rodada 2026-09-02: a oferta perdida por falta de cadastro da loja
// tem que ser LEGÍVEL na aba Envios, o painel inteiro tem que avisar quem não
// cadastrou nenhuma loja, e o vídeo tutorial tem que sair de um lugar só.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildCredentialBlockHelp,
  buildNoCredentialBanner,
  isCredentialBlockErrorMsg,
  CREDENTIAL_BLOCK_ERROR_PREFIX,
  CREDENTIAL_BLOCK_STATUS_TAG,
} from '../src/credentialBlockAlert/message.js'
import {
  VIDEO_CADASTRO_ETIQUETAS_URL,
  VIDEO_ATIVACAO_ROBO_URL,
  videoEtiquetasParaLoja,
  videoEtiquetasEm,
} from '../src/tutorialVideo.js'
import {
  buildTrialEndingNotice,
  calendarDaysUntil,
  CONFIG_PRESERVED_NOTE,
  TRIAL_NOTICE_WINDOW_DAYS,
} from '../src/domain/painel/trialNotice.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

// --- Reconhecimento da linha -----------------------------------------------

test('reconhece a linha de oferta perdida por falta de cadastro da loja', () => {
  assert.equal(CREDENTIAL_BLOCK_ERROR_PREFIX, 'skip:no_valid_conversions')
  assert.ok(isCredentialBlockErrorMsg('skip:no_valid_conversions'))
  assert.ok(isCredentialBlockErrorMsg('skip:no_valid_conversions:amazon'))
  assert.ok(!isCredentialBlockErrorMsg('skip:dedup_recent_link'))
  assert.ok(!isCredentialBlockErrorMsg(null))
})

test('a etiqueta do histórico nomeia a causa — nunca "ignorado"/"falhou"', () => {
  const label = CREDENTIAL_BLOCK_STATUS_TAG.label.toLowerCase()
  assert.ok(label.includes('loja'), label)
  assert.ok(!label.includes('ignorado'))
  assert.ok(!label.includes('falhou'))
})

// --- Texto do diálogo de ajuda ---------------------------------------------

test('o diálogo NÃO promete que a oferta continua saindo', () => {
  // Para ML/Amazon/Magalu o aviso de código VENCIDO diz "continua saindo, só
  // com o link mais comprido" — verdade lá, mentira aqui: nesta linha a oferta
  // comprovadamente não foi publicada. Ver buildCredentialBlockHelp.
  for (const platform of ['mercadolivre', 'amazon', 'magazineluiza', 'shopee', 'shein']) {
    const help = buildCredentialBlockHelp(platform)
    const primeiro = help.paragraphs[0].toLowerCase()
    assert.ok(!primeiro.includes('continuam saindo'), `${platform}: ${primeiro}`)
    assert.ok(primeiro.includes('não foi publicada'), `${platform}: ${primeiro}`)
    assert.ok(help.nextStep.length > 0)
    assert.equal(help.credentialsHref, '/painel/ids-afiliada')
  }
})

test('o diálogo funciona para loja desconhecida sem inventar nome', () => {
  const help = buildCredentialBlockHelp(undefined)
  assert.equal(help.storeLabel, null)
  assert.ok(!help.title.includes('undefined'))
  assert.ok(help.paragraphs.every((p) => !p.includes('undefined')))
})

test('nenhum jargão técnico chega à tela nos textos de credencial', () => {
  const JARGAO = ['token', 'api key', 'cookie de sessão', 'ssid', 'credencial da api', 'oauth']
  const textos = [
    ...['shopee', 'amazon', 'mercadolivre', 'magazineluiza', 'shein', undefined].flatMap((p) => {
      const h = buildCredentialBlockHelp(p)
      return [h.title, ...h.paragraphs, h.nextStep, h.videoLabel]
    }),
    ...Object.values(buildNoCredentialBanner()),
  ]
  for (const texto of textos) {
    const lower = String(texto).toLowerCase()
    for (const termo of JARGAO) assert.ok(!lower.includes(termo), `"${termo}" em: ${texto}`)
  }
})

test('o aviso global de "nenhuma loja cadastrada" leva ao cadastro e ao vídeo', () => {
  const banner = buildNoCredentialBanner()
  assert.equal(banner.ctaHref, '/painel/ids-afiliada')
  assert.ok(banner.headline.toLowerCase().includes('loja'))
  assert.ok(banner.videoLabel.toLowerCase().includes('vídeo'))
})

// --- Vídeo em um lugar só ---------------------------------------------------

test('o vídeo abre no trecho da loja pedida', () => {
  assert.equal(videoEtiquetasParaLoja('amazon'), videoEtiquetasEm(250))
  assert.equal(videoEtiquetasParaLoja('shopee'), videoEtiquetasEm(103))
  assert.equal(videoEtiquetasParaLoja('magazineluiza'), videoEtiquetasEm(562))
  // Loja sem capítulo próprio cai no começo do vídeo, nunca em undefined.
  assert.equal(videoEtiquetasParaLoja('shein'), VIDEO_CADASTRO_ETIQUETAS_URL)
  assert.equal(videoEtiquetasParaLoja(undefined), VIDEO_CADASTRO_ETIQUETAS_URL)
})

test('nenhuma tela do painel cola o endereço do vídeo na mão', () => {
  // Três cópias do mesmo link é como um vídeo regravado passa a existir só em
  // parte do produto. A fonte única é src/tutorialVideo.js.
  const telas = [
    '../dashboard/app/painel/tutorial/page.js',
    '../dashboard/app/painel/checklist/page.js',
    '../dashboard/app/painel/whatsapp/page.js',
    '../dashboard/app/painel/PainelShell.js',
  ]
  for (const tela of telas) {
    const src = read(tela)
    assert.ok(!/https:\/\/youtu\.be\//.test(src), `${tela} tem link de vídeo colado na mão`)
  }
})

test('src/email/layout.js continua exportando o vídeo (consumidores antigos)', async () => {
  const layout = await import('../src/email/layout.js')
  assert.equal(layout.VIDEO_CADASTRO_ETIQUETAS_URL, VIDEO_CADASTRO_ETIQUETAS_URL)
  assert.equal(typeof layout.videoEtiquetasEm, 'function')
  assert.equal(typeof layout.videoEtiquetasVars, 'function')
  assert.ok(Array.isArray(layout.VIDEO_ETIQUETAS_CAPITULOS))
})

test('o vídeo de ativação é constante própria (não é o de credenciais)', () => {
  assert.notEqual(VIDEO_ATIVACAO_ROBO_URL, VIDEO_CADASTRO_ETIQUETAS_URL)
})

// --- Aviso de fim de teste --------------------------------------------------

test('o aviso de fim de teste só existe para trial dentro da janela', () => {
  const now = new Date('2026-09-02T10:00:00Z')
  const base = { plan: 'trial', accessExpiresAt: '2026-09-04T10:00:00Z', offersPublished: 10, now }
  assert.ok(buildTrialEndingNotice(base))
  assert.equal(buildTrialEndingNotice({ ...base, plan: 'pro' }), null)
  assert.equal(buildTrialEndingNotice({ ...base, accessExpiresAt: null }), null)
  assert.equal(buildTrialEndingNotice({ ...base, accessExpiresAt: 'quinta' }), null)
  // Fora da janela: ainda falta muito.
  assert.equal(
    buildTrialEndingNotice({ ...base, accessExpiresAt: '2026-09-30T10:00:00Z' }),
    null,
  )
  assert.equal(TRIAL_NOTICE_WINDOW_DAYS, 3)
})

test('trial já vencido não gera aviso (quem avisa é o banner de plano vencido)', () => {
  const notice = buildTrialEndingNotice({
    plan: 'trial',
    accessExpiresAt: '2026-09-01T10:00:00Z',
    offersPublished: 10,
    now: new Date('2026-09-02T10:00:00Z'),
  })
  assert.equal(notice, null)
})

test('o aviso traz a PROVA do que o robô já fez, com plural certo', () => {
  const now = new Date('2026-09-02T10:00:00Z')
  const muitas = buildTrialEndingNotice({ plan: 'trial', accessExpiresAt: '2026-09-04T10:00:00Z', offersPublished: 143, now })
  assert.ok(muitas.body.includes('143 ofertas'))
  assert.equal(muitas.ctaHref, '/painel/plano')

  const uma = buildTrialEndingNotice({ plan: 'trial', accessExpiresAt: '2026-09-04T10:00:00Z', offersPublished: 1, now })
  assert.ok(uma.body.includes('1 oferta '), uma.body)
})

test('sem nenhuma oferta publicada o aviso muda de assunto — não cobra', () => {
  // Pedir pagamento de quem nunca viu o produto funcionar é o jeito mais
  // rápido de perder a cliente: o aviso vira ajuda para configurar.
  const notice = buildTrialEndingNotice({
    plan: 'trial',
    accessExpiresAt: '2026-09-04T10:00:00Z',
    offersPublished: 0,
    now: new Date('2026-09-02T10:00:00Z'),
  })
  assert.equal(notice.hasProof, false)
  assert.equal(notice.ctaHref, '/painel/checklist')
  assert.ok(!notice.body.toLowerCase().includes('assine'))
})

test('o aviso de fim de teste fala em linguagem de gente', () => {
  const now = new Date('2026-09-02T10:00:00Z')
  const JARGAO = ['trial', 'churn', 'upgrade', 'assinatura recorrente', 'preapproval', 'gateway']
  for (const offersPublished of [0, 5]) {
    const n = buildTrialEndingNotice({ plan: 'trial', accessExpiresAt: '2026-09-03T10:00:00Z', offersPublished, now })
    const texto = `${n.headline} ${n.body} ${n.ctaLabel} ${n.secondaryLabel || ''}`.toLowerCase()
    for (const termo of JARGAO) assert.ok(!texto.includes(termo), `"${termo}" em: ${texto}`)
  }
})

// --- D3/D4 do plano de ativação de 2026-09-08 --------------------------------

test('no DIA do vencimento o aviso diz "hoje" — não "amanhã"', () => {
  // Regressão: `Math.ceil(msLeft / DAY_MS)` com msLeft sempre positivo nunca
  // devolvia 0, então o ramo 'hoje' era código morto e o aviso do último dia
  // dizia "amanhã". A decisão de pagar acontece no dia do vencimento (mediana
  // de 6,2 a 7 dias entre cadastro e pagamento) — adiar a frase adia a venda.
  const notice = buildTrialEndingNotice({
    plan: 'trial',
    accessExpiresAt: '2026-09-08T23:00:00-03:00',
    offersPublished: 47,
    now: new Date('2026-09-08T09:00:00-03:00'),
  })
  assert.equal(notice.daysLeft, 0)
  assert.ok(notice.headline.includes('hoje'), notice.headline)
  assert.ok(!notice.headline.includes('amanhã'), notice.headline)
})

test('vencimento no dia seguinte continua sendo "amanhã"', () => {
  const notice = buildTrialEndingNotice({
    plan: 'trial',
    accessExpiresAt: '2026-09-09T02:00:00-03:00',
    offersPublished: 5,
    now: new Date('2026-09-08T22:00:00-03:00'),
  })
  assert.equal(notice.daysLeft, 1)
  assert.ok(notice.headline.includes('amanhã'), notice.headline)
})

test('fuso inválido não deixa a cliente sem aviso (fail-safe)', () => {
  const dias = calendarDaysUntil(
    new Date('2026-09-08T09:00:00Z'),
    new Date('2026-09-10T09:00:00Z'),
    'Fuso/Inventado',
  )
  assert.equal(dias, 2)
})

test('todo pedido de pagamento promete que a configuração continua salva', () => {
  // O medo de quem chega ao fim do teste é perder grupos, lojas e regras — não
  // o preço. Sem essa frase o pedido de pagamento parece recomeçar do zero.
  const notice = buildTrialEndingNotice({
    plan: 'trial',
    accessExpiresAt: '2026-09-10T10:00:00Z',
    offersPublished: 47,
    now: new Date('2026-09-08T10:00:00Z'),
  })
  assert.ok(notice.body.includes(CONFIG_PRESERVED_NOTE), notice.body)
  for (const termo of ['grupos', 'lojas', 'regras']) {
    assert.ok(CONFIG_PRESERVED_NOTE.toLowerCase().includes(termo), termo)
  }
})

test('quem nunca viu oferta sair NÃO recebe promessa de pagamento', () => {
  // Esse ramo leva ao checklist, não ao plano: falar de "religar o envio" para
  // quem nunca viu envio nenhum é cobrar por algo que ela não experimentou.
  const notice = buildTrialEndingNotice({
    plan: 'trial',
    accessExpiresAt: '2026-09-10T10:00:00Z',
    offersPublished: 0,
    now: new Date('2026-09-08T10:00:00Z'),
  })
  assert.ok(!notice.body.includes(CONFIG_PRESERVED_NOTE))
  assert.equal(notice.ctaHref, '/painel/checklist')
})

test('a tela de plano usa a MESMA frase, importada — não uma cópia', () => {
  const page = readFileSync(
    new URL('../dashboard/app/painel/plano/page.js', import.meta.url),
    'utf8',
  )
  assert.match(page, /import \{ CONFIG_PRESERVED_NOTE \} from/)
  assert.match(page, /\{CONFIG_PRESERVED_NOTE\}/)
  assert.ok(
    !page.includes('continuam salvos do jeito que estão'),
    'a frase foi colada na tela em vez de importada da fonte única',
  )
})
