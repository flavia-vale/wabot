import { decryptCredential } from './credentialCrypto.js'

const PLATFORM_LABELS = {
  shopee: 'Shopee',
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magazine Luiza',
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

  return warnings
}

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
  const warnings = missing.length ? [] : getFormatWarnings(platform, data)
  const configured = missing.length === 0

  return {
    platform,
    label: PLATFORM_LABELS[platform],
    status: configured ? (warnings.length ? 'warning' : 'configured') : 'incomplete',
    configured,
    missing,
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

  return body
}
