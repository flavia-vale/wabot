// Módulo puro (sem DB/rede/Prisma) de política de refresh do OAuth do
// Mercado Livre.
//
// Contexto (005-ml-cookie-expiry, causa raiz nova CONFIRMADA em research.md):
// `getMlUserToken` (src/converters/productInfoScraper.js) fazia
// `grant_type=refresh_token` quando o access token expirava, mas DESCARTAVA
// o `refresh_token` rotacionado que o ML devolve na resposta. Como o refresh
// token do ML é rotativo/single-use (cada refresh invalida o anterior e emite
// um novo), reenviar o refresh_token antigo na próxima renovação falha e a
// credencial "morre", exigindo recadastro manual da usuária.
//
// Este módulo extrai a decisão ("preciso mesmo chamar o ML?") e a construção
// do patch de credencial ("o que exatamente devo persistir?") em funções
// puras e testáveis — espelhando o contrato já usado no eixo cookie
// (`buildCredentialPatchFromSetCookie` em mercadolivre.js): quem chama a API
// (`getMlUserToken`) não decide sozinho, e quem persiste (rota/worker) recebe
// um patch pronto para cifrar via `encryptCredential`.

const OAUTH_EXPIRY_MARGIN_S = 300 // mesma margem de segurança usada em mlOAuth.js

/**
 * Decide se é preciso chamar o ML para renovar o access token, reusar o
 * existente, ou se o OAuth nem está configurado para esta credencial.
 *
 * @param {object} creds - credencial ML (pode conter oauthAccessToken,
 *   oauthTokenExpiry, oauthRefreshToken).
 * @param {number} now - epoch ms injetável (testes).
 * @returns {{ action: 'reuse'|'refresh'|'skip', token?: string }}
 */
export function buildOAuthRefreshDecision(creds, now = Date.now()) {
  const oauthRefreshToken = creds?.oauthRefreshToken
  const oauthAccessToken = creds?.oauthAccessToken
  const oauthTokenExpiry = creds?.oauthTokenExpiry

  if (oauthAccessToken && now < (oauthTokenExpiry || 0)) {
    return { action: 'reuse', token: oauthAccessToken }
  }
  if (oauthRefreshToken) {
    return { action: 'refresh' }
  }
  return { action: 'skip' }
}

/**
 * Constrói o patch de credencial a partir da resposta de refresh do ML.
 * Nunca regride: se a resposta não trouxer `refresh_token` novo, mantém o
 * anterior (nunca apaga); se não trouxer `access_token`, retorna `null` (o
 * chamador não deve sobrescrever nada — falha transitória, FR-008).
 *
 * Idempotente: reprocessar a mesma `tokenResponse` sempre produz o mesmo
 * patch (não há estado mutável compartilhado nem regressão de tokens).
 *
 * @param {object} prevCreds - credencial anterior (para preservar
 *   oauthRefreshToken quando a resposta não trouxer um novo).
 * @param {object} tokenResponse - corpo JSON da resposta do
 *   POST /oauth/token (`access_token`, `refresh_token?`, `expires_in`).
 * @param {number} now - epoch ms injetável (testes).
 * @returns {{ oauthAccessToken: string, oauthTokenExpiry: number, oauthRefreshToken: string }|null}
 */
export function applyOAuthTokenResponse(prevCreds, tokenResponse, now = Date.now()) {
  const accessToken = tokenResponse?.access_token
  if (!accessToken) return null

  const expiresIn = Number(tokenResponse?.expires_in)
  const oauthTokenExpiry = now + ((Number.isFinite(expiresIn) ? expiresIn : 0) - OAUTH_EXPIRY_MARGIN_S) * 1000
  const oauthRefreshToken = tokenResponse?.refresh_token || prevCreds?.oauthRefreshToken

  return {
    oauthAccessToken: accessToken,
    oauthTokenExpiry,
    oauthRefreshToken,
  }
}
