// Modo sem cookie ("cookieless") — privacidade das credenciais de afiliado.
//
// Contexto: cadastrar o SSID do Mercado Livre (ou o cookie da sessão Amazon)
// incomoda parte das clientes — é o cookie de sessão da conta delas, e quem
// tem o cookie fica "logado como elas" até ele expirar. A preocupação é
// legítima e não dá para resolver com texto tranquilizador sozinho.
//
// O produto NÃO depende desses cookies para funcionar:
//   - Mercado Livre: sem `ssid`, `convert()` (src/converters/mercadolivre.js)
//     pula a API de afiliados e cai no fallback `partner_id=<tag>` na URL do
//     produto — a oferta sai, só não encurta para meli.la.
//   - Amazon: sem cookie, `convert()` (src/converters/amazon.js, `hasCookies`)
//     usa o `?tag=` longo — e o RCA de 2026-07 ("Amazon: a tag PRECISA estar
//     dentro da longUrl") comprovou EM CAMPO que esse formato credita comissão
//     normalmente (o período com cookie expirado foi justamente o que teve
//     cliques registrados).
//
// Então o cookie é OTIMIZAÇÃO (link curto + conversão de cupom sem produto),
// não requisito. Este módulo transforma isso em escolha explícita da usuária:
// com `cookielessMode` ligado, a credencial guarda só a tag/etiqueta, os campos
// de cookie são apagados do que persistimos e o painel para de cobrar/alarmar
// sobre sessão expirada.
//
// Módulo PURO de propósito (sem DB/rede/crypto): consumido por
// `src/credentialHealth.js` (validação/sanitização) e pelas rotas em
// `src/api/routes/credentials.js`. Teste: `test/credential-cookieless-mode.test.js`.

// Campos que carregam sessão/identidade da conta da usuária em cada plataforma.
// `csrf`/`id` (ML) e os 3 cookies nomeados (Amazon) entram na lista porque são
// artefatos de rotação da MESMA sessão — apagar só o `ssid`/`cookie` deixaria
// resíduo autenticável para trás.
export const COOKIE_FIELDS_BY_PLATFORM = {
  mercadolivre: ['ssid', 'cookie', 'csrf', 'id'],
  amazon: ['cookie', 'ubid-acbbr', 'at-acbbr', 'x-acbbr'],
}

export const COOKIELESS_PLATFORMS = Object.keys(COOKIE_FIELDS_BY_PLATFORM)

export function supportsCookielessMode(platform) {
  return COOKIELESS_PLATFORMS.includes(platform)
}

// O corpo vem de JSON HTTP: aceita boolean real e a string 'true' (checkbox
// serializado), mas nada além disso — qualquer outro valor é "modo desligado".
function isFlagOn(value) {
  return value === true || value === 'true'
}

export function isCookielessMode(platform, data) {
  return supportsCookielessMode(platform) && isFlagOn(data?.cookielessMode)
}

// Remove todo campo de sessão da plataforma. Retorna objeto novo (não muta).
export function stripCookieFields(platform, data = {}) {
  const fields = COOKIE_FIELDS_BY_PLATFORM[platform]
  if (!fields || !data || typeof data !== 'object') return data
  const out = {}
  for (const [key, value] of Object.entries(data)) {
    if (!fields.includes(key)) out[key] = value
  }
  return out
}

// Normaliza o corpo salvo quando a usuária liga o modo sem cookie: flag como
// boolean real + zero campo de sessão persistido. Como o PUT de credenciais
// sobrescreve o blob inteiro (`data`), ligar o modo APAGA de fato o cookie que
// já estava guardado — não é só deixar de usar.
export function applyCookielessMode(platform, body = {}) {
  if (!isCookielessMode(platform, body)) return body
  return { ...stripCookieFields(platform, body), cookielessMode: true }
}

// Campos obrigatórios que sobram quando o modo está ligado: tudo que não é
// cookie. Usado pela validação para não marcar a credencial como "incompleta"
// só porque a usuária escolheu não entregar a sessão.
export function filterRequiredFieldsForCookieless(platform, requiredFields = []) {
  const fields = COOKIE_FIELDS_BY_PLATFORM[platform]
  if (!fields) return requiredFields
  return requiredFields.filter(field => !fields.includes(field))
}
