import { decryptCredential } from './credentialCrypto.js'

const PLATFORM_LABELS = {
  shopee: 'Shopee',
  amazon: 'Amazon',
  mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magazine Luiza',
}

export const PLATFORMS = Object.keys(PLATFORM_LABELS)

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
    const tag = getString(data, 'tag')
    const ssid = getString(data, 'ssid')
    if (tag && !/^\d+$/.test(tag)) warnings.push('A tag do Mercado Livre normalmente é numérica.')
    if (ssid && ssid.length < 10) warnings.push('O SSID do Mercado Livre parece curto. Confira se copiou o valor completo do cookie.')
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
    return `Credenciais de ${validation?.label ?? 'plataforma'} incompletas. Preencha: ${(validation?.missing ?? []).join(', ')}.`
  }
  if (validation.warnings?.length) {
    return `Credenciais de ${validation.label} salvas, mas há alertas para revisar antes do bot converter links dessa loja.`
  }
  return `Credenciais de ${validation.label} salvas e prontas para conversão.`
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
  if (platform !== 'mercadolivre' || !body || typeof body !== 'object') return body
  const ssid = typeof body.ssid === 'string' ? body.ssid.trim() : ''
  if (!ssid) return body
  const { cookie, csrf, id, ...rest } = body
  return rest
}
