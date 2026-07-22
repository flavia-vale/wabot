// Módulo puro (db-free/env-free, sem import de db.js/analytics.js/rede) com os
// helpers de manipulação de cookie do eixo Mercado Livre. Extraído de
// `mercadolivre.js` (linhas ~432-520) para ser reutilizado tanto pelo eixo de
// afiliado (`checkMercadoLivreSession`) quanto pelo scrape web autenticado
// (`productInfoScraper.js`) — fonte única de verdade, sem duplicar lógica
// (FR-002/FR-015 de specs/006-ml-cookie-expiry-followup).
//
// Corpo idêntico ao anteriormente definido em mercadolivre.js — só exportado.

export function parseCookieHeader(cookieHeader = '') {
  const jar = new Map()
  for (const part of String(cookieHeader || '').split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return jar
}

export function getSetCookieLines(headers = {}) {
  const value = headers?.['set-cookie'] ?? headers?.['Set-Cookie']
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

// Detecta `Set-Cookie` de DELEÇÃO. O ML (e qualquer servidor) apaga um cookie
// reemitindo-o com valor vazio (`ssid=;`), `Max-Age=0` ou `Expires` no passado.
// Tratar uma deleção como "rotação" gravaria `ssid=` vazio no jar — e como o jar
// (`cookie`) tem precedência sobre o campo `ssid` em buildCookieHeader, isso
// passaria a enviar um SSID vazio em todo request, brickando uma sessão que
// ainda podia estar viva (deleção transitória/espúria). Por isso deleções são
// IGNORADAS: nunca sobrescrevem nem removem um valor já conhecido no jar. Se o
// ML realmente nos deslogou, o próximo request responde 401 e o painel sinaliza
// expiração — sem depender de persistir o cookie de deleção.
export function parseSetCookieLine(line) {
  const raw = String(line || '')
  const first = raw.split(';')[0]?.trim()
  if (!first) return null
  const eq = first.indexOf('=')
  if (eq <= 0) return null
  const name = first.slice(0, eq)
  const value = first.slice(eq + 1)
  const attrs = raw.slice(raw.indexOf(';') + 1)
  const maxAgeZero = /;\s*max-age\s*=\s*0\s*(?:;|$)/i.test(raw)
  const expiresPast = (() => {
    const m = raw.match(/;\s*expires\s*=\s*([^;]+)/i)
    if (!m) return false
    const ts = Date.parse(m[1].trim())
    return Number.isFinite(ts) && ts <= Date.now()
  })()
  const isDeletion = value === '' || maxAgeZero || (attrs && expiresPast)
  return { name, value, isDeletion }
}

export function mergeSetCookieIntoJar(cookieHeader, setCookieLines) {
  const jar = parseCookieHeader(cookieHeader)
  for (const line of setCookieLines) {
    const parsed = parseSetCookieLine(line)
    if (!parsed) continue
    // Deleção nunca poda/sobrescreve o jar — só rotações com valor real entram.
    if (parsed.isDeletion) continue
    jar.set(parsed.name, parsed.value)
  }
  return jar
}

export function serializeCookieJar(jar) {
  // Defesa em profundidade: nunca serializar par com valor vazio (um `ssid=`
  // vazio no header de cookie derruba a autenticação no ML).
  return [...jar.entries()]
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

export function buildCredentialPatchFromSetCookie(creds = {}, cookieHeader = '', headers = {}) {
  const lines = getSetCookieLines(headers)
  if (!lines.length) return null
  const before = parseCookieHeader(cookieHeader)
  const after = mergeSetCookieIntoJar(cookieHeader, lines)
  const changedNames = [...after.keys()].filter(name => before.get(name) !== after.get(name))
  if (!changedNames.length) return null

  const patch = { cookie: serializeCookieJar(after) }
  if (after.has('ssid')) patch.ssid = after.get('ssid')
  if (after.has('_csrf')) patch.csrf = after.get('_csrf')
  if (after.has('id')) patch.id = after.get('id')

  // Quando a credencial foi cadastrada em campos separados, mantenha os campos
  // conhecidos mesmo que o ML só tenha rotacionado cookies companheiros no jar.
  if (!patch.ssid && creds.ssid) patch.ssid = creds.ssid
  if (!patch.csrf && creds.csrf) patch.csrf = creds.csrf
  if (!patch.id && creds.id) patch.id = creds.id
  return patch
}
