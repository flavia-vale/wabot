import { decryptCredential } from './credentialCrypto.js'
import { extractSheinAffiliateId, normalizeSheinDigits } from './converters/shein.js'

const PLATFORM_LABELS = {
  shopee: 'Shopee',
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magazine Luiza',
  shein: 'SHEIN',
  aliexpress: 'AliExpress',
}

export const PLATFORMS = Object.keys(PLATFORM_LABELS)

// Como cada campo é CHAMADO para a usuária. As mensagens de erro/save saíam com
// o nome técnico do campo ("Campos obrigatórios: ssid/cookie, ubid-acbbr"), que
// não diz nada para quem só quer divulgar oferta. Toda mensagem que chega na
// tela passa por `friendlyFieldName` — se um campo novo não estiver no mapa, o
// fallback é o próprio nome (nunca quebra, só fica menos amigável).
const FIELD_LABELS = {
  tag: 'sua etiqueta de afiliado',
  'ssid/cookie': 'o código de acesso da sua conta',
  ssid: 'o código de acesso da sua conta',
  cookie: 'o código de acesso da sua conta',
  'ubid-acbbr': 'o código de acesso da sua conta',
  'at-acbbr': 'o código de acesso da sua conta',
  'x-acbbr': 'o código de acesso da sua conta',
  appId: 'o App ID da Shopee',
  secretKey: 'a chave secreta da Shopee',
  appKey: 'a chave do aplicativo',
  appSecret: 'o segredo do aplicativo',
  trackingId: 'a identificação de rastreamento',
}

export function friendlyFieldName(field) {
  return FIELD_LABELS[field] ?? field
}

// Recado único de "falta cadastrar" — usado no painel, no motor de ofertas e no
// worker, para a usuária ler sempre a MESMA frase, em português comum, em vez de
// três variações com nome técnico de campo.
export function describeMissingCredentials(validation) {
  const pendencias = joinFriendly(validation?.missing ?? [])
  const loja = validation?.label ?? 'loja'
  const oQueFalta = pendencias ? `Faltou preencher ${pendencias} da ${loja}.` : `Faltam dados da ${loja}.`
  return `${oQueFalta} Abra "Minhas credenciais" no painel para completar — leva menos de um minuto.`
}

// Junta a lista de pendências em português corrente ("A e B", "A, B e C") —
// vírgula seca no fim de frase soa a erro de sistema, não a recado.
function joinFriendly(fields = []) {
  const names = [...new Set(fields.map(friendlyFieldName))]
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

export const REQUIRED_FIELDS = {
  shopee: ['appId', 'secretKey'],
  amazon: ['tag', 'ubid-acbbr', 'at-acbbr', 'x-acbbr'],
  mercadolivre: ['tag'],
  magazineluiza: ['tag'],
  shein: ['tag'],
  aliexpress: ['appKey', 'appSecret', 'trackingId'],
}

function hasValue(value) {
  return String(value ?? '').trim().length > 0
}

function getString(data, key) {
  return String(data?.[key] ?? '').trim()
}

function getFormatWarnings(platform, data = {}) {
  const warnings = []

  if (platform === 'shopee') {
    const appId = getString(data, 'appId')
    const secretKey = getString(data, 'secretKey')
    if (appId && !/^\d+$/.test(appId)) warnings.push('O App ID da Shopee normalmente contém apenas números.')
    if (secretKey && secretKey.length < 16) warnings.push('A Secret Key da Shopee parece curta. Confira se copiou a chave inteira.')
  }

  if (platform === 'amazon') {
    const tag = getString(data, 'tag')
    if (tag && !tag.includes('-')) warnings.push('A tag da Amazon normalmente contém um sufixo como -20.')
    for (const cookie of ['ubid-acbbr', 'at-acbbr', 'x-acbbr']) {
      const value = getString(data, cookie)
      if (value && value.length < 10) warnings.push(`O cookie ${cookie} parece curto. Confira se copiou apenas o valor completo do cookie.`)
    }
  }

  if (platform === 'mercadolivre') {
    const ssid = getString(data, 'ssid')
    if (ssid && ssid.length < 10) warnings.push('O SSID do Mercado Livre parece curto. Confira se copiou o valor completo do cookie.')
    const vitrineUrl = getString(data, 'vitrineUrl')
    if (vitrineUrl && !/^https?:\/\/[^/]*(mercadolivre|mercadolibre|meli\.la|mluvem\.com)/i.test(vitrineUrl)) {
      warnings.push('O link da sua vitrine não parece ser um link do Mercado Livre. Confira se colou a URL correta.')
    }
  }

  if (platform === 'magazineluiza') {
    const tag = getString(data, 'tag')
    if (tag && tag.length < 3) warnings.push('A tag do Magazine Luiza parece curta. Confira se copiou a tag completa.')
  }

  if (platform === 'aliexpress') {
    const appKey = getString(data, 'appKey')
    const appSecret = getString(data, 'appSecret')
    const trackingId = getString(data, 'trackingId')
    if (appKey && !/^\d+$/.test(appKey)) warnings.push('A chave do aplicativo da AliExpress normalmente contém apenas números.')
    if (appSecret && appSecret.length < 16) warnings.push('O segredo do aplicativo da AliExpress parece curto. Confira se copiou o valor inteiro.')
    if (trackingId && trackingId.length < 2) warnings.push('A identificação de rastreamento da AliExpress parece curta. Confira se copiou o valor inteiro.')
  }

  // Nota: a checagem de comprimento do número da SHEIN é recusa DURA (não
  // aviso leve) — ver SHEIN_TAG_MIN_DIGITS/SHEIN_TAG_MAX_DIGITS e o bloco
  // `platform === 'shein'` em validateCredentialData, T076.

  return warnings
}

// Faixa plausível de comprimento do número de afiliada da SHEIN, depois de
// normalizado (T076). Os números reais observados na integração têm 10
// dígitos (ver contracts/credential-shein.md). Não travamos em exatamente 10
// — variações de conta legítimas podem existir — mas damos uma folga
// generosa (6 a 15) que ainda recusa o que claramente não é um identificador
// real: nem 1-2 dígitos, nem uma sequência de dezenas de dígitos (60 dígitos,
// por exemplo, não corresponde a nenhuma conta e geraria comissão perdida em
// silêncio, do mesmo jeito que o zero à esquerda).
export const SHEIN_TAG_MIN_DIGITS = 6
export const SHEIN_TAG_MAX_DIGITS = 15

// Recusa dura da SHEIN: `sanitizeCredentialBody` só normaliza o que sabe
// interpretar (link de afiliada com identificador visível, ou o número puro).
// O que sobra sem virar número — oneLink ainda não expandido, link do botão
// "compartilhar" do app (GM7/shc/link), ou texto qualquer — precisa ser
// recusado aqui com uma explicação que ensina onde pegar o link certo (a
// entrada continua "mantida como veio" pela normalização, então cai neste
// ramo). Mensagens em linguagem leiga (FR-007) — nenhum jargão técnico.
function sheinFormatWarnings(tag) {
  if (!tag) return []
  if (/^\d+$/.test(tag)) {
    // T076: comprimento fora da faixa plausível — zero à esquerda já foi
    // removido por sanitizeCredentialBody antes de chegar aqui, então um
    // número curto demais ou longo demais não é erro de digitação de zeros,
    // é um número que não parece ser o de afiliada de verdade.
    if (tag.length < SHEIN_TAG_MIN_DIGITS || tag.length > SHEIN_TAG_MAX_DIGITS) {
      return [
        'Esse número não parece ser o ID de afiliado da SHEIN. Confira se copiou o ID completo, ' +
        'sem espaços ou caracteres a mais — ou copie de novo no painel de afiliada da SHEIN.',
      ]
    }
    return []
  }
  if (/GM7|[?&](?:shc|link)=/i.test(tag)) {
    return [
      'Esse link é do botão de compartilhar do aplicativo da SHEIN, e ele não serve para cadastro. ' +
      'Copie o seu ID de afiliado (em Minha conta) ou gere um link no Gerador de Link, no painel de afiliada da SHEIN.',
    ]
  }
  return [
    'Não reconhecemos esse texto. Era esperado o seu link de afiliada da SHEIN (o link que você gera no ' +
    'painel de afiliada) ou o seu ID de afiliado, que fica no painel em Minha conta.',
  ]
}

// Regras de formato por campo de código de acesso.
//
// `singleToken`: o valor é UM valor só (não pode ter espaço). O código completo
// da Amazon e o pacote do ML são listas de vários pares (`a=1; b=2`) e por isso
// PODEM ter espaço — aplicar a regra neles recusaria credencial legítima.
// `minLength` só é usado onde há evidência de produção do tamanho real: os
// códigos do ML que funcionam têm 83-85 caracteres. Os códigos separados da
// Amazon variam de tamanho e ficam de fora (continuam com o aviso brando de
// `getFormatWarnings`).
const ACCESS_CODE_RULES = {
  mercadolivre: [
    { field: 'ssid', singleToken: true, minLength: 30 },
    { field: 'cookie' },
  ],
  amazon: [
    { field: 'cookie' },
    { field: 'ubid-acbbr', singleToken: true },
    { field: 'at-acbbr', singleToken: true },
    { field: 'x-acbbr', singleToken: true },
  ],
}

// Formato claramente errado no código de acesso. NÃO diz se a loja aceita o
// código (só ela sabe) — barra o que nunca poderia funcionar: link colado no
// lugar do código, valor com espaço onde não cabe espaço, pedaço faltando.
//
// Por que existe (investigação 18/08/2026): a validação só conferia se o campo
// estava preenchido. Uma conta salvou um LINK no lugar do código, o painel
// respondeu "Tudo certo!" e o robô acumulou 537 recusas seguidas do Mercado
// Livre sem que nada no painel denunciasse. Outras quatro contas estavam com
// 10, 16 e 52 caracteres — todas marcadas como prontas para usar.
//
// Espelhado na tela em `describeInvalidAffiliateValue`
// (dashboard/lib/painel/affiliatePlatforms.js). Aqui é a autoridade.
export function describeInvalidCredentialFields(platform, data = {}) {
  const problemas = []
  if (platform === 'aliexpress') {
    const appKey = getString(data, 'appKey')
    const appSecret = getString(data, 'appSecret')
    const trackingId = getString(data, 'trackingId')
    if (appKey && !/^\d{2,32}$/.test(appKey)) problemas.push({ field: 'appKey', message: 'A chave do aplicativo deve conter somente números e ter no máximo 32 caracteres.' })
    if (appSecret && (appSecret.length < 16 || appSecret.length > 256 || /\s/.test(appSecret))) problemas.push({ field: 'appSecret', message: 'O segredo do aplicativo deve ter entre 16 e 256 caracteres e não pode conter espaços.' })
    if (trackingId && (trackingId.length > 128 || /[\u0000-\u001f\u007f]/.test(trackingId))) problemas.push({ field: 'trackingId', message: 'A identificação de rastreamento deve ter no máximo 128 caracteres e não pode conter caracteres de controle.' })
    return problemas
  }
  for (const regra of ACCESS_CODE_RULES[platform] ?? []) {
    const value = getString(data, regra.field)
    if (!value) continue
    if (/^https?:\/\//i.test(value)) {
      problemas.push({ field: regra.field, message: LINK_NO_LUGAR_DO_CODIGO })
      continue
    }
    if (regra.singleToken && /\s/.test(value)) {
      problemas.push({ field: regra.field, message: CODIGO_COM_ESPACO })
      continue
    }
    if (regra.minLength && value.length < regra.minLength) {
      problemas.push({ field: regra.field, message: CODIGO_CURTO_DEMAIS })
    }
  }
  return problemas
}

export const LINK_NO_LUGAR_DO_CODIGO = 'Isso é um link, não o código de acesso. O código não começa com "http" — é uma sequência de letras e números que você copia com a extensão Cookie-Editor.'
export const CODIGO_COM_ESPACO = 'O código não pode ter espaços no meio. Copie o valor inteiro, de uma vez só.'
export const CODIGO_CURTO_DEMAIS = 'Esse código está curto demais — parece que faltou um pedaço. Copie o valor inteiro do campo na extensão Cookie-Editor.'

export function validateCredentialData(platform, data = {}) {
  if (!PLATFORMS.includes(platform)) {
    return {
      platform,
      label: platform,
      status: 'invalid_platform',
      configured: false,
      missing: [],
      warnings: ['Plataforma inválida.'],
    }
  }

  const required = REQUIRED_FIELDS[platform] ?? []
  const missing = required.filter(field => !hasValue(data?.[field]))

  if (platform === 'amazon') {
    // O cookie string COMPLETO da sessão (campo `cookie`) satisfaz a autenticação
    // do SiteStripe sozinho — não exigir os 3 cookies nomeados quando ele existe.
    // Ver buildCookieHeader em src/converters/amazon.js.
    const rawCookie = getString(data, 'cookie')
    if (rawCookie.length >= 20) {
      for (const legacy of ['ubid-acbbr', 'at-acbbr', 'x-acbbr']) {
        const idx = missing.indexOf(legacy)
        if (idx !== -1) missing.splice(idx, 1)
      }
    }
  }

  if (platform === 'mercadolivre') {
    const ssid = getString(data, 'ssid')
    const cookie = getString(data, 'cookie')
    const hasAuthCarrier = ssid.length >= 10 || cookie.length >= 20
    if (!hasAuthCarrier) {
      missing.push('ssid/cookie')
    }
  }

  // SHEIN: presença de valor sozinha não basta — um texto qualquer, o link do
  // botão de compartilhar do app, ou um oneLink que sanitizeCredentialBody
  // não conseguiu resolver offline, todos "têm valor" mas não servem. Recusa
  // dura (não fica "configured" com aviso) — a cliente precisa colar o link/
  // número certo antes de a loja aparecer pronta.
  let sheinRecusaWarnings = []
  if (platform === 'shein') {
    const tag = getString(data, 'tag')
    const isPlausibleNumber = /^\d+$/.test(tag) && tag.length >= SHEIN_TAG_MIN_DIGITS && tag.length <= SHEIN_TAG_MAX_DIGITS
    if (tag && !isPlausibleNumber) {
      if (!missing.includes('tag')) missing.push('tag')
      sheinRecusaWarnings = sheinFormatWarnings(tag)
    }
  }

  const warnings = sheinRecusaWarnings.length
    ? sheinRecusaWarnings
    : missing.length ? [] : getFormatWarnings(platform, data)
  const configured = missing.length === 0
  // `invalid` é separado de `missing` de propósito: o campo ESTÁ preenchido (só
  // que com conteúdo que nunca vai funcionar). Manter `configured` amarrado a
  // `missing` preserva o comportamento de todo mundo que já lê esse campo; quem
  // precisa barrar o save olha `invalid`.
  const invalid = configured ? describeInvalidCredentialFields(platform, data) : []

  return {
    platform,
    label: PLATFORM_LABELS[platform],
    status: invalid.length ? 'invalid' : (configured ? (warnings.length ? 'warning' : 'configured') : 'incomplete'),
    configured,
    missing,
    invalid,
    warnings,
  }
}

export function parseCredentialData(rawData) {
  try {
    // D-3: o campo `data` pode vir cifrado (formato v1:...). decryptCredential é
    // transparente para texto puro/legado, então cobre os dois casos. Único ponto
    // de leitura que NÃO passa por aqui é bot-worker.js (decifrado lá direto).
    const decoded = typeof rawData === 'string' ? decryptCredential(rawData) : rawData
    const parsed = typeof decoded === 'string' ? JSON.parse(decoded) : decoded
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function summarizeCredentialHealth(credentials = []) {
  const byPlatform = new Map(credentials.map(credential => [credential.platform, parseCredentialData(credential.data)]))
  return PLATFORMS.map(platform => {
    const data = byPlatform.get(platform)
    if (!data) {
      return {
        platform,
        label: PLATFORM_LABELS[platform],
        status: 'missing',
        configured: false,
        missing: REQUIRED_FIELDS[platform] ?? [],
        warnings: [],
      }
    }
    return validateCredentialData(platform, data)
  })
}

export function getCredentialSaveMessage(validation) {
  if (!validation?.configured) {
    // Recusa com mensagem específica (ex.: SHEIN recusando link de
    // compartilhamento) tem precedência sobre a genérica "faltou preencher" —
    // aqui o campo TEM valor, só não é o formato certo (SC-008: a mensagem
    // precisa levar ao link certo sozinha).
    if (validation?.warnings?.length) return validation.warnings[0]
    return `Faltou preencher ${joinFriendly(validation?.missing ?? [])} da ${validation?.label ?? 'loja'}.`
  }
  if (validation.warnings?.length) {
    return `Salvamos os dados da ${validation.label}, mas confira os avisos abaixo antes de começar a divulgar.`
  }
  return `Tudo certo! A ${validation.label} está pronta e suas ofertas já saem com a sua comissão.`
}

// Quando a usuária cola um SSID NOVO do Mercado Livre, o `cookie` (jar completo)
// e o `_csrf`/`id` persistidos por rotações anteriores ficam OBSOLETOS — e, pior,
// `buildCookieHeader` dá precedência ao `cookie` sobre o `ssid`. Sem limpar, o jar
// antigo (com o ssid expirado dentro) sombreava o ssid recém-colado e a credencial
// continuava "expirada" para sempre. O formulário do painel só coleta tag+ssid;
// qualquer `cookie`/`csrf`/`id` no corpo é round-trip de artefato de rotação. Então,
// ao salvar ML com ssid explícito, descartamos esses artefatos — a rotação os
// reconstrói no primeiro createLink bem-sucedido.
export function sanitizeCredentialBody(platform, body = {}) {
  if (!body || typeof body !== 'object') return body

  // Resíduo do "modo sem cookie" (removido a pedido da cliente): credenciais
  // salvas naquela janela ficaram com `cookielessMode: true` guardado. A
  // validação já ignora a flag, mas ela não pode ser REGRAVADA a cada save —
  // senão o resíduo sobrevive para sempre e reativaria o modo em silêncio caso
  // alguém reintroduza a leitura da flag. Limpeza das linhas antigas:
  // `scripts/cleanup-cookieless-flag.mjs`.
  if ('cookielessMode' in body) {
    const { cookielessMode: _legado, ...semFlag } = body
    return sanitizeCredentialBody(platform, semFlag)
  }

  if (platform === 'mercadolivre') {
    const ssid = typeof body.ssid === 'string' ? body.ssid.trim() : ''
    if (!ssid) return body
    const { cookie, csrf, id, ...rest } = body
    return rest
  }

  // Amazon: quando a usuária cola o cookie COMPLETO da sessão, ele é a fonte única
  // de verdade (contém at-acbbr/session-token/etc.). Descartamos os 3 cookies
  // nomeados legados para não sombrear a sessão nova com valores antigos (mesmo
  // racional do ML ssid vs cookie). buildCookieHeader dá precedência ao `cookie`.
  if (platform === 'amazon') {
    const cookie = typeof body.cookie === 'string' ? body.cookie.trim() : ''
    if (!cookie) return body
    const { 'ubid-acbbr': _ubid, 'at-acbbr': _at, 'x-acbbr': _x, ...rest } = body
    return { ...rest, cookie }
  }

  // SHEIN: a cliente pode colar o número puro OU um link de afiliada com o
  // identificador visível na URL (`koc_id=<n>` ou `url_from=affiliate_koc_<n>`).
  // Normalização é OFFLINE (só parsing de URL, sem rede) — um oneLink que
  // ainda não expõe o identificador na URL, o link do botão de compartilhar
  // (GM7/shc/link), ou texto qualquer, ficam como vieram e são reprovados na
  // validação (`validateCredentialData`), que ensina onde pegar o link certo
  // (ou, na rota de save, resolvidos pela rede — ver T075 em
  // src/api/routes/credentials.js).
  if (platform === 'shein') {
    const raw = typeof body.tag === 'string' ? body.tag.trim() : ''
    if (!raw) return { ...body, tag: raw }
    // T076: zero à esquerda não corresponde à conta real (a SHEIN não usa
    // padding) — normaliza antes de validar comprimento/salvar, para
    // `0009876543` virar `9876543` em vez de gerar um identificador que
    // nunca vai bater com a conta da cliente.
    if (/^\d+$/.test(raw)) return { ...body, tag: normalizeSheinDigits(raw) }
    try {
      const u = new URL(raw)
      const extracted = extractSheinAffiliateId(u.toString())
      if (extracted) return { ...body, tag: normalizeSheinDigits(extracted) }
    } catch {
      // não é URL — mantém como veio, cai na recusa da validação
    }
    return body
  }

  if (platform === 'aliexpress') {
    const cleaned = {}
    for (const key of ['appKey', 'appSecret', 'trackingId']) {
      cleaned[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
    }
    return cleaned
  }

  return body
}
